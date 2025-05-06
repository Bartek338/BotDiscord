module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        const { customId } = interaction;

        if (customId.startsWith('ticket_create_')) {
            const categoryId = customId.replace('ticket_create_', '');
            await client.ticketManager.createTicket(interaction, categoryId);
            return;
        }

        if (customId.startsWith('ticket_') && !interaction.member.roles.cache.has(client.config.tickets.staffRole)) {
            await interaction.reply({
                content: 'Nie masz uprawnień do tej akcji!',
                ephemeral: true
            });
            return;
        }

        switch (customId) {
            case 'ticket_close':
                await client.ticketManager.closeTicket(interaction);
                break;

            case 'ticket_rename':
                const modal = new Modal()
                    .setCustomId('ticket_rename_modal')
                    .setTitle('Zmień nazwę ticketu')
                    .addComponents(
                        new TextInputComponent()
                            .setCustomId('new_name')
                            .setLabel('Nowa nazwa')
                            .setStyle('SHORT')
                            .setRequired(true)
                    );
                await interaction.showModal(modal);
                break;

            case 'ticket_add':
                const addModal = new Modal()
                    .setCustomId('ticket_add_modal')
                    .setTitle('Dodaj użytkownika')
                    .addComponents(
                        new TextInputComponent()
                            .setCustomId('user_id')
                            .setLabel('ID użytkownika')
                            .setStyle('SHORT')
                            .setRequired(true)
                    );
                await interaction.showModal(addModal);
                break;

            case 'ticket_remove':
                const removeModal = new Modal()
                    .setCustomId('ticket_remove_modal')
                    .setTitle('Usuń użytkownika')
                    .addComponents(
                        new TextInputComponent()
                            .setCustomId('user_id')
                            .setLabel('ID użytkownika')
                            .setStyle('SHORT')
                            .setRequired(true)
                    );
                await interaction.showModal(removeModal);
                break;
        }
    }
}; 