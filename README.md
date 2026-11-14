<p align="center">
  <a href="https://github.com/AlvisChrs/growserver-core">
    <img src=".github/logo.svg" width="130" height="130" alt="GrowServer Core Logo" />
  </a>
</p>

<h1 align="center">GrowServer Core</h1>

<p align="center">
  A high-performance, modular sandbox server emulator built with <b>Bun</b>, <b>TypeScript</b>, and native <b>ENet WebAssembly</b>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun%20v1.3+-2b2b2b?style=flat-square&logo=bun" alt="Bun"/>
  <img src="https://img.shields.io/badge/language-TypeScript-3178C6?style=flat-square&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/protocol-ENet%20WASM-orange?style=flat-square" alt="ENet"/>
  <img src="https://img.shields.io/badge/proxy-Caddy%20HTTPS-00ADD8?style=flat-square&logo=caddy" alt="Caddy"/>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License"/>
</p>

---

## ⚠️ Legal Disclaimer

> **IMPORTANT:** This project is an independent, non-commercial open-source server emulator developed strictly for **educational, security research, and protocol interoperability purposes**. 
> 
> - **Growtopia** is a registered trademark of **Ubisoft Entertainment**. 
> - This project is **not** affiliated with, authorized, maintained, sponsored, or in any way associated with Ubisoft Entertainment or its affiliates.
> - **No proprietary binary game files, game assets, or copyrighted materials** are hosted or distributed within this repository. All asset loading relies on locally generated caches, user-provided resources, or public open-source archives.

---

## ✨ Features

- **Blazing Fast Performance:** Powered by [Bun](https://bun.sh) and native ENet networking compiled to WebAssembly via [growtopia.wasm](https://github.com/StileDevs/growtopia.wasm).
- **Modern Client Compatibility:** Full support for modern Growtopia PC clients (including the modern OAuth/Web Login modal with Argon2id password hashing).
- **Automated Local TLS:** Integrated [Caddy](https://caddyserver.com) reverse proxy automating local HTTPS termination on port 443 with self-signed certificate generation.
- **Dynamic Wearables & Double Jump:** Automatic detection of flight capabilities, double jumps, speed boosts, and play mods for all back and wing items across 16,400+ items.
- **Rich In-Game Command Suite (30+ Commands):**
  - Item spawning (`/give`, `/find`, `/search`)
  - World manipulation (`/nuke`, `/fillworld`, `/undo`, `/backup`, `/restore`, `/rain`, `/cleardrops`)
  - Player physics & godmode (`/ghost`, `/invis`, `/speed`, `/gravity`, `/zoom`, `/heal`, `/fly`)
  - Instant tree harvesting (`/growall`)
  - Title customization (`/title <Dr.|Master|Legend|Hero|...>`)
  - Currency & roles (`/gems`, `/level`, `/nick`, `/giverole`)
- **Pre-Built Worlds Included:**
  - `START`: Grand Castle hub with red carpets, developer throne room, rare item displays, and warp portals.
  - `PARKOUR`: 5 challenging obstacle stages with checkpoints and a victory prize hall.
  - `FARM`: Cleaned world with 14 full rows of platforms ready for mass planting.
  - `CASINO`: Royale gaming hall with interactive roulette wheels, slot machines, and dice blocks.

---

## 📋 Prerequisites

- **OS:** Windows 10/11, macOS, or Linux.
- **Runtime:** [Bun](https://bun.sh) (v1.3.0 or later).
- **Game Client:** Official Growtopia PC Client.
- **Reverse Proxy:** [Caddy](https://caddyserver.com) (can be downloaded automatically during setup with `--with-caddy`).

---

## 🚀 Quickstart (Windows 1-Click)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AlvisChrs/growserver-core.git
   cd growserver-core
   ```

2. **Configure Local Hosts:**
   Right-click `setup-hosts.bat` and select **Run as Administrator** to map the local test domains to `127.0.0.1`.

3. **Install Dependencies & Initialize:**
   ```bash
   bun install
   bun run setup --with-caddy
   ```

4. **Launch & Play:**
   Double-click `play.bat`. This automatically starts Caddy, launches the game server, and boots the Growtopia client.
   - When playing for the first time, click **Log In** on the client and register your desired GrowID and password.
   - To give yourself developer permissions, type in the server terminal:
     ```text
     role <your-growid> developer
     ```

---

## 🛠️ Manual Installation & Setup

### 1. System Hosts Setup
Add the following entries to your hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows, or `/etc/hosts` on Unix):

```hosts
127.0.0.1 login.growserver.test
127.0.0.1 cdn.growserver.test
127.0.0.1 growtopia1.com
127.0.0.1 growtopia2.com
127.0.0.1 www.growtopia1.com
127.0.0.1 www.growtopia2.com
```

### 2. First-Time Setup
Run the automated initialization script to compile local TLS certificates, run database migrations, and resolve items data:

```bash
bun run setup --with-caddy
```

### 3. Start the Server
To run both the game server and Caddy reverse proxy together:

```bash
bun run start:local
```

### 4. Interactive Server Console
An interactive CLI console is available directly in the terminal while the server is active:
- `ping`: Health-check the server loop (`pong`).
- `list`: Show all currently connected players across all sub-servers.
- `role <growid> <basic|supporter|moderator|developer>`: Set player permission rank.
- `say <message>`: Global administrative announcement in chat.
- `save`: Force an immediate save flush of all modified world maps to disk.
- `stop`: Gracefully disconnect players, flush world binaries, and shutdown.

### 5. Troubleshooting

| Symptom in the client | Cause / Fix |
| :--- | :--- |
| **"Check your internet and make sure you are not using VPN"** | `server_data.php` was not answered: the client alternates between `growtopia1.com` and `growtopia2.com` (both with and without `www`). Ensure all hosts resolve to `127.0.0.1` via `setup-hosts.bat` and Caddy is running. |
| **"rejected server data request"** | The logon user agent differs per platform. Only clients presenting standard `UbiServices_SDK` headers are accepted. |
| **"Download failed" for garbage file names after login** | `items.dat` mismatch. Delete `.cache/wiki.json` and run `bun run wiki` or `bun run setup` to refresh cache. |
| **Chat says "Chat is disabled"** | GDPR compliance flag. Ensure the account age is set to 2 and the server responds with GDPR override. |
| **White avatar / empty profile HUD** | The avatar net ID was uninitialized; players obtain sequential network IDs starting from 1 upon entering a world. |
| **Client remains connected after stopping server** | Server was hard-terminated (`kill -9`). Use `Ctrl+C` or the console `stop` command so disconnect packets are dispatched cleanly. |

---

## 🎮 In-Game Commands Reference

As an administrator / developer (`role_id: 1`), you have access to all commands:

| Category | Command | Description |
| :--- | :--- | :--- |
| **Items & Economy** | `/give <item> [amount]` | Directly adds items to your backpack without opening dialogs. |
| | `/find [item name]` | Opens searchable item dialog across all items. |
| | `/search` | Opens visual searchable item list. |
| | `/gems [target] <amount>` | Instantly adds gems to yourself or target. |
| | `/starter` | Grants the ultimate admin starter kit (BGLs, DLs, Rayman, Wings, Tools). |
| | `/clearinv` | Empties your entire backpack in one second. |
| **Abilities & Physics** | `/ghost` / `/unghost` | Toggles noclip and flight through blocks. |
| | `/invis` | Toggles complete invisibility. |
| | `/fly` | Toggles mid-air double-jump flight without requiring wings. |
| | `/speed <value\|reset>` | Sets custom run velocity (e.g. `/speed 3000`). |
| | `/gravity <value\|reset>` | Sets custom gravity (e.g. `/gravity 200` for moon gravity). |
| | `/zoom <value\|reset>` | Adjusts world camera zoom level. |
| | `/heal` | Clears curses, duct tape, frozen status, and injuries. |
| **World Control** | `/nuke` | Clears all blocks in the world instantly (auto-creates undo snapshot). |
| | `/fillworld [block]` | Fills entire world with a chosen block (e.g. `/fillworld bedrock`, `/fillworld lava`). |
| | `/undo` | Reverts the world to before the last `/fillworld` or `/nuke`. |
| | `/backup` / `/restore` | Saves and restores manual world snapshots. |
| | `/rain <item> [amount]` | Rains dropped items evenly across the world map. |
| | `/cleardrops` | Wipes all dropped items on the ground. |
| | `/weather <weather>` | Changes sky atmosphere (e.g. `aurora`, `night`, `sunset`, `space`, `snow`). |
| | `/growall` | Instantly matures all planted trees for harvesting. |
| **Identity & Roles** | `/title <title\|clear>` | Sets in-game display title (e.g. `/title Dr.`, `/title Legend`, `/title Master`). |
| | `/nick <new name>` | Changes your display name instantly. |
| | `/level <1-125>` | Sets account level instantly. |
| | `/giverole <target> <0-4>` | Sets player permissions (`0` User, `1` Dev, `2` Mod, `3` Supporter, `4` Owner). |
| **Teleport & Moderation** | `/warp <world:door>` | Warps to any world or specific door ID. |
| | `/tp <target>` / `/pull <target>` | Teleport to a player or pull them to your position. |
| | `/kick <target>` / `/ban <target>` | Moderation tools to disconnect or ban players. |

---

## 🔧 Architecture Overview

```
Growtopia Client
  │
  ├── Port 443 HTTPS ─────────► Caddy Reverse Proxy (Local TLS)
  │                                │
  │                                ├──► Hono Server (17900) - /growtopia/server_data.php
  │                                ├──► Login Server (17901) - Web Login & Dashboard
  │                                └──► CDN Server (17902) - Static Assets & RTTEX
  │
  └── Port 17091 UDP ─────────► GrowServer Game Engine (ENet Native WASM)
                                   │
                                   ├── Database: Kysely + LibSQL (data/local.db)
                                   └── World Storage: GSWD Atomic Binary Files (data/worlds/)
```

---

## 🤝 Contributing

Contributions, bug reports, and pull requests are welcome:
1. Fork this repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📜 License & Credits

- Licensed under the **[MIT License](LICENSE)**.
- Original project architecture created by [JadlionHD](https://github.com/JadlionHD) and open-source contributors.
- WebAssembly protocol layer powered by [growtopia.wasm](https://github.com/StileDevs/growtopia.wasm).
