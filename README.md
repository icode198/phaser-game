# Top-Down Phaser Game with React

<img src="/source_files/game_sample.gif?raw=true" width="890px" />

# Key Features
- Built with Create React App
- Uses Phaser 3 for game engine
- State management with Zustand
- UI with Material UI and React 18
- CSS Modules
- Uses functional programming style
- Arcade physics
- Automatically resizes game to fit browser window
- Automatically loads Tilesets and assets
- Generates atlas sheets with included script
- Adjustable tile sizes
- Integrates Phaser and React through Zustand
- Dialog system (React-based)
- Game menu (React-based)
- Virtual Gamepad for mobile devices (React-based)
- Includes 2D assets from Kenney.nl

# How to Use

## Load Scene Files
The `getScenesModules` function uses Webpack's [require.context](https://webpack.js.org/guides/dependency-management/#requirecontext) to load all `.js` and `.ts` files from the `/src/assets/games/scenes` directory. Simply add your game scenes there to have them loaded into the game.

The first scene loaded by Phaser JS is the one defined in the `constants.js` file, in the `BOOT_SCENE_NAME` variable.

## Functional Programming
Scene code can be written in a functional style for improved readability, by exporting functions instead of using the `Phaser.Scene` class.

```javascript
// Export scene using class-based approach
export default class BootScene extends Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.load.image('background', background);
    }

    create() {
        this.add.image(100, 100, 'background');
    }
}
```

```javascript
// Export scene in functional approach
export const sceneHelpers = {};

export const key = 'BootScene';

export function preload() {
    scene.load.image('background', background);
}

export function create() {
    scene.add.image(100, 100, 'background');
}
```

The exported `scene` object will have all the helper functions of `Phaser.Scene`. While it can still be accessed with `this`, the functional approach is designed to improve code readability.

This "magic" is made possible by the `prepareScene` function.

## Maps
To use Tiled maps, add your Tiled tilesets JSON and images to `/src/assets/tilesets` and your Tiled maps to `/src/assets/maps`. Then start the `LoadAssetsScene` like this:

```javascript
this.scene.start('LoadAssetsScene', {
    nextScene: 'GameScene', // Scene to load after assets are loaded
    assets: {
        mapKey: 'sample_map', // Map name, e.g. sample_map.json
    },
});
```

Any tilesets used in your `sample_map.json` will be automatically loaded from the `/src/assets/tilesets` directory, as long as they are located there.

## Other assets
To load other assets such as images, fonts, or atlases, call the `LoadAssetsScene` with the following parameters:

```javascript
this.scene.start('LoadAssetsScene', {
    nextScene: 'GameScene', // scene to be loaded after the assets are loaded
    assets: {
        fonts: ['"Press Start 2P"'], // fonts to be loaded
        atlases: ['hero'], // atlases to be loaded, must be in `/src/assets/atlases/generated/` as hero.json and hero.png
        images: ['background'], // images to be loaded, must be in `/src/assets/images` as background.png
    },
});
```

## The 'GameScene'
The `GameScene` file is where the game map is rendered, along with all items, enemies, etc. The `create` function is split into smaller functions for easier readability, which can be found in the `sceneHelpers.js` file.

## Virtual Gamepad
The virtual gamepad will be automatically loaded when the game is run on a mobile device. The virtual gamepad is a React component that simulates keyboard keys to control the game, using the `simulateKeyEvent` function found in this [GitHub Gist](https://gist.github.com/GlauberF/d8278ce3aa592389e6e3d4e758e6a0c2).

## Dialog System
A dialog box will appear automatically whenever the `state.dialog.messages` variable is populated with messages. To accomplish this, you can call the `setDialogMessagesAction` Zustand setter function.

```javascript
setDialogMessages(['hello world', 'hello world 2']);
```

# Assets:

https://opengameart.org/content/16-bit-animated-bomb

https://porito.itch.io/16x16

https://alexs-assets.itch.io/16x16-rpg-item-pack

**Free Software, Hell Yeah!**
