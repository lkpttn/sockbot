# SockBot
Sockbot is a simple, single-server discord bot that we use to manage event creation. It's extremely narrowly
scoped to our preferences and needs.

### Commands
`/create` invokes the bot with the following templates:
- Fractals
- Raids
- Party
- Squad
- Freeform

Each template has the following properties:
- Name 
- Description
- Capacity
- Start time
- Duration
- Roles
- @Mention role

When invoking `/create` a user chooses a template, name and start time - and can optionally add a description, custom duration or custom roles. Start time is dynamically interpreted based on the bot's time zone (Eastern) and understands GW2 concepts like "Reset + 1".

 Events are managed via an embed with buttons for each role. When a user selects a role, they are added to the event with their roles listed. Users can add or remove additional roles by clicking more buttons.

 When an event has reached capacity, additional users are added to a waitlist. If an attending user drops off, the first user on the waitlist will promoted into the event.

 A thread is created for each event for additional discussion. Accepted users are automatically added to the thread, and removed from the thread if they remove their signup.

 Events are cleaned up 2 hours after their start date, deleting the message and accompanying thread. Events are stored in an `events.json` file and dynamically saved and loaded by the bot when users act or the bot is reloaded.