const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    ComponentType,
    GuildChannel
} = require('discord.js');
const config = require('../config.json');
class TicketManager {
    constructor(client) {
        this.client = client;
        this.config = client.config.tickets;
    }

    async ensureCategory(guild, categoryConfig, categoryKey) {
        let category;

        if (categoryConfig.categoryId) {
            category = guild.channels.cache.get(categoryConfig.categoryId);
            if (category) {
                this.client.handler.logger.log('DEBUG', `Found existing category by ID: ${category.name} (${category.id})`);
                return category;
            }
        }

        const categoryIdentifier = `[${categoryKey}]`; 
        category = guild.channels.cache.find(channel => 
            channel.type === ChannelType.GuildCategory && 
            channel.name.startsWith(categoryIdentifier)
        );

        if (!category) {
            try {
                category = await guild.channels.create({
                    name: `${categoryIdentifier} ${categoryConfig.name}`, 
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: this.config.staffRole,
                            allow: [
                                PermissionFlagsBits.ViewChannel, 
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels
                            ],
                        }
                    ]
                });

                categoryConfig.categoryId = category.id;
                this.client.handler.logger.log('NORMAL', `Created new category: ${category.name} (${category.id})`);
            } catch (error) {
                this.client.handler.logger.log('NORMAL', `Error creating category: ${error.message}`);
                throw error;
            }
        } else {
            categoryConfig.categoryId = category.id;
            this.client.handler.logger.log('DEBUG', `Found existing category by key: ${category.name} (${category.id})`);
        }

        return category;
    }

    async hasTicketInCategory(guild, userId, categoryId) {
        const channels = guild.channels.cache.filter(channel => 
            channel.type === ChannelType.GuildText && 
            channel.parentId === categoryId && 
            channel.topic === userId 
        );

        return channels.size > 0;
    }

    async findTicketChannel(guild, userId, categoryId) {
        return guild.channels.cache.find(channel => 
            channel.type === ChannelType.GuildText &&
            channel.parentId === categoryId && 
            channel.topic === userId
        );
    }

    async createTicketPanel(channel) {
        const embed = new EmbedBuilder()
            .setTitle('System Ticketów')
            .setDescription('Wybierz kategorię ticketu klikając odpowiedni przycisk poniżej.')
            .setColor('#0099ff');

        const buttons = Object.entries(this.config.categories).map(([id, category]) => {
            return new ButtonBuilder()
                .setCustomId(`ticket_create_${id}`)
                .setLabel(category.name)
                .setStyle(ButtonStyle.Primary);
        });

        const row = new ActionRowBuilder().addComponents(buttons);

        await channel.send({
            embeds: [embed],
            components: [row]
        });
    }

    async createTicket(interaction, categoryId) {
        const category = this.config.categories[categoryId];
        if (!category) return;

        try {

            const categoryChannel = await this.ensureCategory(interaction.guild, category, categoryId);

            const existingTicket = await this.findTicketChannel(
                interaction.guild,
                interaction.user.id,
                categoryChannel.id
            );

            if (existingTicket) {
                await interaction.reply({
                    content: `Masz już otwarty ticket w kategorii ${category.name}! ${existingTicket}`,
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryChannel.id,
                topic: `${interaction.user.id}|creator`,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel, 
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ],
                    },
                    {
                        id: this.config.staffRole,
                        allow: [
                            PermissionFlagsBits.ViewChannel, 
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels
                        ],
                    }
                ]
            });

            const controlButtons = [
                new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('Zamknij')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_rename')
                    .setLabel('Zmień nazwę')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_add')
                    .setLabel('Dodaj użytkownika')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('ticket_remove')
                    .setLabel('Usuń użytkownika')
                    .setStyle(ButtonStyle.Secondary)
            ];

            const controlRow = new ActionRowBuilder().addComponents(controlButtons);

            const embed = new EmbedBuilder()
                .setTitle('Ticket utworzony')
                .setDescription(`Witaj ${interaction.user}! Staff niedługo się tobą zajmie.`)
                .setColor('#00ff00')
                .addFields(
                    { name: 'Kategoria', value: category.name },
                    { name: 'ID użytkownika', value: interaction.user.id }
                );

            await channel.send({
                embeds: [embed],
                components: [controlRow]
            });

            await this.logTicketAction(interaction.guild, {
                action: 'create',
                user: interaction.user,
                ticketId: channel.id
            });

            await interaction.editReply({
                content: `Ticket utworzony! ${channel}`,
                ephemeral: true
            });

        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Error creating ticket: ${error.message}`);
            
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: 'Wystąpił błąd podczas tworzenia ticketu. Spróbuj ponownie później.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: 'Wystąpił błąd podczas tworzenia ticketu. Spróbuj ponownie później.',
                    ephemeral: true
                });
            }
        }
    }

    async logTicketAction(guild, { action, user, ticketId, extra = {} }) {
        if (!this.config.loggingChannel) {
            this.client.handler.logger.log('NORMAL', 'Kanał logowania nie jest skonfigurowany');
            return;
        }

        try {
            const channel = this.client.channels.cache.get(config.tickets.loggingChannel);
            if (!channel) {
                this.client.handler.logger.log('NORMAL', `Nie znaleziono kanału logowania o ID: ${config.tickets.loggingChannel}`);
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('📝 Log Ticketu')
                .setColor('#0099ff')
                .setTimestamp();

            const ticketChannel = guild.channels.cache.get(ticketId);
            const ticketLink = ticketChannel ? `[Przejdź do ticketu](${ticketChannel.url})` : 'Kanał nie istnieje';

            switch (action) {
                case 'create':
                    embed.setDescription(`🎫 Ticket utworzony przez ${user.tag}\n${ticketLink}`)
                        .setColor('#00ff00');
                    break;
                case 'close':
                    embed.setDescription(`🔒 Ticket zamknięty przez ${user.tag}`)
                        .setColor('#ff0000');
                    break;
                case 'rename':
                    embed.setDescription(`✏️ Ticket zmieniony przez ${user.tag}\n${ticketLink}`)
                        .addFields({ name: 'Nowa nazwa', value: extra.newName })
                        .setColor('#ffff00');
                    break;
                case 'adduser':
                    embed.setDescription(`➕ Użytkownik dodany do ticketu przez ${user.tag}\n${ticketLink}`)
                        .addFields({ name: 'Dodany użytkownik', value: extra.targetUser })
                        .setColor('#00ff00');
                    break;
                case 'removeuser':
                    embed.setDescription(`➖ Użytkownik usunięty z ticketu przez ${user.tag}\n${ticketLink}`)
                        .addFields({ name: 'Usunięty użytkownik', value: extra.targetUser })
                        .setColor('#ff9900');
                    break;
            }

            const components = [];
            if (action === 'create' && ticketChannel) {
                const buttons = [
                    new ButtonBuilder()
                        .setCustomId(`log_delete_${ticketId}`)
                        .setLabel('🗑️ Usuń Ticket')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`log_info_${ticketId}`)
                        .setLabel('ℹ️ Info o użytkowniku')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setLabel('🔗 Przejdź do Ticketu')
                        .setStyle(ButtonStyle.Link)
                        .setURL(ticketChannel.url)
                ];
                components.push(new ActionRowBuilder().addComponents(buttons));
            }

            await channel.send({
                embeds: [embed],
                components: components
            });
        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Błąd podczas logowania akcji ticketu: ${error.message}`);
        }
    }
}

module.exports = TicketManager; 