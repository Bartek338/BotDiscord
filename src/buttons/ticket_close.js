const { ButtonStyle } = require('discord.js');

module.exports = {
    customId: 'ticket_close',
    staffOnly: true,
    async execute(interaction, client) {
        try {
            const channel = interaction.channel;
            const guild = interaction.guild;
            const channelId = channel.id;

            if (!channel.topic || !channel.parentId) {
                await interaction.reply({
                    content: 'Ten kanał nie jest ticketem!',
                    ephemeral: true
                });
                return;
            }

            if (!interaction.member.roles.cache.has(client.config.tickets.staffRole)) {
                await interaction.reply({
                    content: 'Nie masz uprawnień do zamknięcia ticketu!',
                    ephemeral: true
                });
                return;
            }

            try {
                await client.ticketManager.logTicketAction(guild, {
                    action: 'close',
                    user: interaction.user,
                    ticketId: channelId
                });
            } catch (error) {
                client.handler.logger.log('NORMAL', `Error logging ticket close: ${error.message}`);
            }

            await interaction.reply({
                content: 'Ticket zostanie zamknięty za 5 sekund...',
                ephemeral: false
            });
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (deleteError) {
                    client.handler.logger.log('NORMAL', `Error deleting channel: ${deleteError.message}`);
                }
            }, 5000);
            
        } catch (error) {
            console.log(error);
            client.handler.logger.log('NORMAL', `Error in ticket_close button: ${error.message}`);
            if (!interaction.replied) {
                await interaction.reply({
                    content: 'Wystąpił błąd podczas zamykania ticketu!',
                    ephemeral: true
                });
            }
        }
    }
}; 