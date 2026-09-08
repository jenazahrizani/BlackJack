# Blackjack 21

A cinematic, first-person Blackjack 21 experience built around immersive casino visuals, smooth animations, and classic blackjack gameplay.

Step into the casino, place your bets, and challenge the dealer. Every hand is a new opportunity to test your strategy and beat the house.

## Features

* 🎰 Immersive first-person casino table
* 🃏 Classic Blackjack 21 gameplay
* 💰 Interactive betting system
* 🎯 Hit, Stand, and Double Down actions
* 🏦 Dealer AI and card management
* 🎴 Animated card dealing and card flips
* 🪙 Chip placement, sliding, and collection animations
* 🎥 Cinematic camera movements
* 💡 Ambient lighting and casino atmosphere
* ✨ Smooth UI transitions and visual feedback
* 📱 Responsive game interface
* ⚡ TypeScript-based game architecture

## Gameplay

The goal of Blackjack is to beat the dealer by getting a hand value as close to **21** as possible without going over.

### Card Values

| Card              | Value      |
| ----------------- | ---------- |
| 2–10              | Face value |
| Jack, Queen, King | 10         |
| Ace               | 1 or 11    |

### Available Actions

* **Hit** — Draw another card.
* **Stand** — Keep your current hand and end your turn.
* **Double Down** — Double your bet and receive one additional card.
* **Place Bet** — Choose your wager before the round begins.

### Winning

You win by:

* Having a higher hand value than the dealer.
* Getting a Blackjack when the dealer does not.
* Having the dealer bust while your hand remains valid.

A hand exceeding 21 is a **bust** and loses the round.

## Project Structure

```text
src/
├── Blackjack.ts    # Blackjack game logic and rules
├── Entities.ts     # Cards, chips, dealer, and game entities
├── Game.ts         # Main game loop and state management
├── Input.ts        # Mouse, keyboard, and player interaction
└── Renderer.ts     # Rendering, animations, and visual effects

public/
└── assets/         # Game assets, textures, and media

index.html          # Main game page
```

## Architecture

The game is organized into several core systems:

### Blackjack

Handles the rules of blackjack, card values, hand calculations, dealer behavior, and round outcomes.

### Entities

Defines the objects used in the game, including cards, chips, the dealer, and other interactive elements.

### Game

Controls the main game loop, game states, round progression, and communication between systems.

### Input

Processes player interactions such as mouse clicks, keyboard input, and table actions.

### Renderer

Manages the visual presentation of the game, including the casino table, cards, chips, dealer animations, and camera effects.

## Animation System

The game uses a visual-first animation system designed to create a more cinematic experience.

Animations include:

* Dealer breathing and head movement
* Dealer arm and hand motion
* Card dealing
* Card flipping
* Card placement
* Chip placement
* Chip sliding
* Chip collection
* Player idle motion
* Camera push
* Smooth cinematic transitions

The animation system is designed to make every action feel connected to the table rather than simply appearing instantly.

## Getting Started

### Prerequisites

* Node.js
* npm
* A modern web browser

### Installation

Clone the repository:

```bash
git clone https://github.com/your-username/blackjack-21.git
```

Navigate into the project:

```bash
cd blackjack-21
```

Install dependencies:

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Open the local development URL provided by your framework.

### Production Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Controls

| Action      | Input                    |
| ----------- | ------------------------ |
| Place Bet   | Click betting area       |
| Hit         | Click Hit button         |
| Stand       | Click Stand button       |
| Double Down | Click Double Down button |
| Interact    | Mouse                    |
| Navigate UI | Keyboard                 |

## Design Philosophy

Blackjack 21 focuses on making a traditional card game feel like a cinematic casino experience.

The design combines:

* Dark casino aesthetics
* Premium table materials
* Atmospheric lighting
* Subtle motion
* Responsive interactions
* Clear gameplay feedback
* Realistic card and chip movement

The goal is to create a game that feels immersive without sacrificing usability.

## Roadmap

* [ ] Additional casino table themes
* [ ] More dealer characters
* [ ] Advanced dealer animations
* [ ] Sound effects and casino ambience
* [ ] Music system
* [ ] Improved betting animations
* [ ] More chip denominations
* [ ] Statistics and session history
* [ ] Additional blackjack rule variations
* [ ] Mobile optimization
* [ ] Accessibility improvements

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a new branch.

```bash
git checkout -b feature/your-feature
```

3. Make your changes.
4. Commit your work.

```bash
git commit -m "Add your feature"
```

5. Push your branch.

```bash
git push origin feature/your-feature
```

6. Open a Pull Request.

## License

This project is currently available for personal and educational use.

Add your preferred license before distributing the project publicly.

## Disclaimer

Blackjack 21 is a fictional casino game created for entertainment and demonstration purposes. It does not involve real-money gambling.

---

**Built with TypeScript, creativity, and a love for cinematic game experiences.**
