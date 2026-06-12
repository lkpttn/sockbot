# SockBot

Sockbot is a simple discord bot that we use to manage event creation for Guild Wars 2. It's extremely narrowly scoped to our preferences and needs.

<img width="584" height="533" alt="CleanShot 2025-11-27 at 08 00 25" src="https://github.com/user-attachments/assets/6e716eb1-5ca6-4195-8b18-c0822a6c0fe0" />

### Usage

When invoking `/create` a user chooses a template, name, who to mention, start time, and if some roles are required - they can optionally add a description or custom duration. Start time is dynamically interpreted based the user's time zone and understands GW2 concepts like "Reset + 1".

Events are managed via an embed with buttons for each role. When a user selects a role, they are added to the event with their roles listed. Users can add or remove additional roles by clicking more buttons.

When an event has reached capacity, additional users are added to a waitlist. If an attending user drops off, the first user on the waitlist will promoted into the event.

A thread is created for each event for additional discussion. Accepted users are automatically added to the thread, and removed from the thread if they remove their signup. A reminder is sent to the thread tagging all attending users 15 minutes before an event starts.

Events are cleaned up 2.5 hours after their start date, deleting the message and accompanying thread. Events are stored in an `events.json` file and dynamically saved and loaded by the bot when users act or the bot is reloaded.

### Commands

`/create` invokes the bot with the following templates:

- Party (5 people)
- Squad (10 people)
- Freeform (20 people)

Each template has the following properties:

- Name
- @Mention role
- Start time
- Role requirements
- Description
- Duration

### Role requirements

Party and Squad events can ask for specific role signups. If a user selects true during event creation, the events will be created with:

- Party (Glutbender)
- Squad (Kite, Tank)

### Start Time Guide

SockBot understands normal event times, simple relative phrases, time zones, and Guild Wars 2 reset time.
If you do not include a time zone, SockBot assumes Eastern time.

Examples:

| What you type      | What SockBot means                                              |
| ------------------ | --------------------------------------------------------------- |
| `8pm`              | The next 8:00 PM Eastern                                        |
| `today 8pm`        | 8:00 PM today in Eastern time                                   |
| `tomorrow 8pm`     | 8:00 PM tomorrow in Eastern time                                |
| `Friday 9pm`       | The next Friday at 9:00 PM Eastern                              |
| `8pm PST`          | 8:00 PM Pacific time                                            |
| `tomorrow 7pm CST` | 7:00 PM tomorrow in Central time                                |
| `reset`            | The next Guild Wars 2 daily reset, at 00:00 UTC                 |
| `reset+1`          | One hour after the next reset                                   |
| `reset+1.5`        | One hour and 30 minutes after the next reset                    |
| `tomorrow reset`   | The reset that happens tomorrow evening in the chosen time zone |

Tips:

- Use `tomorrow` when you mean the next calendar day.
- Use a weekday name when planning farther ahead, like `Wednesday 8pm`.
- You can write `EST` or `EDT`; SockBot treats both as Eastern time for the date you chose.
- You can write `PST` or `PDT`; SockBot treats both as Pacific time for the date you chose.
- If `today 8pm` has already passed, SockBot will ask you to pick a future time. Use `tomorrow 8pm` instead.
- Reset is always 00:00 UTC, no matter what time zone you usually use.
- For reset phrases, words like `today` and `tomorrow` use the chosen time zone. Without a time zone, SockBot uses Eastern.

### Bot Permissions

**OAuth2 Scopes:** `bot`, `applications.commands`

**Required Bot Permissions:**

| Permission               | Why                                                                      |
| ------------------------ | ------------------------------------------------------------------------ |
| View Channels            | Basic channel access                                                     |
| Send Messages            | Posting events to channels                                               |
| Send Messages in Threads | Sending reminders in event threads                                       |
| Create Public Threads    | Creating discussion threads for events                                   |
| Manage Threads           | Adding/removing signups from threads, deleting threads on cleanup        |
| Manage Messages          | Deleting event posts and previews                                        |
| Read Message History     | Fetching event messages for cleanup                                      |
| Embed Links              | Rendering event embeds                                                   |
| Mention Everyone         | Pinging roles on event post (not needed if roles are set as mentionable) |

**Permissions integer:** `397284550656`
