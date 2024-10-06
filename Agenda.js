const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const moment = require('moment');
require('moment/locale/fr'); // Charger la locale française

// Utilisation du token à partir des variables d'environnement
const TOKEN = process.env.TOKEN; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.login(TOKEN);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', message => {
    if (message.content === "!ping") {
        message.channel.send("pong");
    }
});

// Chemin du fichier pour sauvegarder l'agenda
const FILE_PATH = './agenda.json';

// Charger l'agenda au démarrage
let agenda = {};
if (fs.existsSync(FILE_PATH)) {
    try {
        agenda = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    } catch (err) {
        console.error('Erreur de lecture du fichier JSON', err);
        agenda = {};  // Réinitialiser si erreur
    }
}

// Sauvegarder l'agenda dans le fichier JSON
function sauvegarderAgenda() {
    fs.writeFileSync(FILE_PATH, JSON.stringify(agenda, null, 2), 'utf8');
}

// Fonction pour créer les commandes avec suggestions
const commands = [
    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Ajouter un devoir à l\'agenda')
        .addStringOption(option => option.setName('matiere').setDescription('Matière').setRequired(true))
        .addStringOption(option => option.setName('devoir').setDescription('Devoir à faire').setRequired(true))
        .addStringOption(option => option.setName('date').setDescription('Date de rendu (jj/mm/aaaa)').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Supprimer un devoir de l\'agenda')
        .addStringOption(option => option.setName('matiere').setDescription('Matière').setRequired(true))
        .addStringOption(option => option.setName('devoir').setDescription('Devoir à supprimer').setRequired(true)),

    new SlashCommandBuilder()
        .setName('agenda')
        .setDescription('Afficher l\'agenda des devoirs'),
];

// Enregistrer les commandes sur Discord
const CLIENT_ID = "1289974998248722483";
const GUILD_ID  = "952541789775085618";

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Déploiement des commandes...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes :', error);
    }
})();

// Gérer les commandes slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'add') {
        const matiere = options.getString('matiere');
        const devoir = options.getString('devoir');
        const date = options.getString('date');

        // Vérifier le format de la date
        const dateFormat = date.split('/');
        const dateReformattee = `${dateFormat[2]}-${dateFormat[1]}-${dateFormat[0]}`; // YYYY-MM-DD

        if (!agenda[matiere]) {
            agenda[matiere] = [];
        }

        // Ajouter le devoir
        agenda[matiere].push({ devoir: devoir, date: dateReformattee });
        sauvegarderAgenda();

        await interaction.reply(`Devoir ajouté pour la matière **${matiere}** : ${devoir} à rendre pour le ${date}`);
    }

    if (commandName === 'remove') {
        const matiere = options.getString('matiere');
        const devoir = options.getString('devoir');

        if (agenda[matiere]) {
            const index = agenda[matiere].findIndex(d => d.devoir.toLowerCase() === devoir.toLowerCase());
            if (index !== -1) {
                agenda[matiere].splice(index, 1);

                if (agenda[matiere].length === 0) {
                    delete agenda[matiere];
                }

                sauvegarderAgenda();
                await interaction.reply(`Le devoir **${devoir}** pour la matière **${matiere}** a été supprimé.`);
            } else {
                await interaction.reply(`Aucun devoir **${devoir}** trouvé pour la matière **${matiere}**.`);
            }
        } else {
            await interaction.reply(`Aucune matière **${matiere}** trouvée dans l'agenda.`);
        }
    }

    if (commandName === 'agenda') {
        let tableauTexte = 'Matière       Devoirs                          Date                \n';
        tableauTexte += '-------------------------------------------------------------------\n';

        const devoirsList = [];

        for (let matiere in agenda) {
            agenda[matiere].forEach(devoir => {
                devoirsList.push({
                    matiere,
                    devoir: devoir.devoir,
                    date: moment(devoir.date, 'YYYY-MM-DD'),
                });
            });
        }

        devoirsList.sort((a, b) => a.date - b.date);

        devoirsList.forEach(({ matiere, devoir, date }) => {
            const dateFormatted = date.format('DD/MM/YYYY');
            const joursRestants = date.diff(moment().startOf('day'), 'days');
            const joursRestantsText = joursRestants === 0 ? '(Aujourd\'hui)' : ` (J-${joursRestants})`;

            tableauTexte += `${matiere.padEnd(13)} ${devoir.padEnd(30)} ${dateFormatted}\n`;
        });

        await interaction.reply(`\`\`\`${tableauTexte}\`\`\``);
    }
});
