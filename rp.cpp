#include <discord_rpc.h> // Include the Discord Rich Presence SDK

void UpdatePresence() {
    DiscordRichPresence discordPresence;
    memset(&discordPresence, 0, sizeof(discordPresence));
    discordPresence.state = "Listening to DM's";
    discordPresence.details = "DM To Get Help";
    discordPresence.largeImageText = "Numbani";
    discordPresence.partyId = "ae488379-351d-4a4f-ad32-2b9b01c91657";
    discordPresence.joinSecret = "MTI4NzM0OjFpMmhuZToxMjMxMjM= ";

    // Update the Discord Rich Presence
    Discord_UpdatePresence(&discordPresence);
}

int main() {
    // Initialize Discord Rich Presence
    DiscordEventHandlers handlers;
    memset(&handlers, 0, sizeof(handlers));
    Discord_Initialize("1240787761129197669", &handlers, 1, NULL);

    // Update presence
    UpdatePresence();

    // Main loop or any other code
    // ...

    // Cleanup Discord Rich Presence
    Discord_Shutdown();

    return 0;
}
