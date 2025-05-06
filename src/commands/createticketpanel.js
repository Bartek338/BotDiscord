const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setName("createticketpanel")
    .setDescription("Tworzy panel z przyciskami do tworzenia ticketów"),
  async execute(interaction) {
    if (
      !interaction.member.roles.cache.has(
        interaction.client.config.tickets.adminRole
      )
    ) {
      return interaction.reply({
        content: "Nie masz uprawnień do tej komendy!",
        ephemeral: true,
      });
    }

    await interaction.client.ticketManager.createTicketPanel(
      interaction.channel
    );
    await interaction.reply({
      content: "Panel ticketów został utworzony!",
      ephemeral: true,
    });
  },
};
