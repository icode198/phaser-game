import { Display, Input, Math as PhaserMath } from 'phaser';

// Constants
import {
    BOMB_SPRITE_NAME,
    DEPTH_DIFF,
    DOOR_TILE_INDEX,
    DOWN_DIRECTION,
    ELEMENT_BOX_TYPE,
    ELEMENT_CRACK_TYPE,
    ELEMENT_GRASS_TYPE,
    ENEMY_SPRITE_PREFIX,
    FOLLOW_BEHAVIOUR,
    HERO_DEPTH,
    HERO_SPRITE_NAME,
    IDLE_FRAME,
    IDLE_FRAME_POSITION_KEY,
    ITEM_DEPTH,
    LAYER_TYPE_TERRAIN,
    LEFT_DIRECTION,
    PATROL_BEHAVIOUR,
    RIGHT_DIRECTION,
    SHOULD_TILE_COLLIDE,
    SLIME_TILE_INDEX,
    SLIME_SPRITE_NAME,
    SWORD_SPRITE_NAME,
    TILE_HEIGHT,
    TILE_WIDTH,
    UI_DEPTH,
    UP_DIRECTION,
} from '../constants';

// Utils
import {
    createInteractiveGameObject,
    getDegreeFromRadians,
    getFileNameWithoutExtension,
    getSelectorData,
    rotateRectangleInsideTile,
} from './utils';

// Selectors
import { selectDialogMessages } from '../zustand/dialog/selectDialog';
import {
    selectCurrentMapKey,
    selectMapKeyData,
    selectMapSetters,
    selectTilesets,
    selectWorldData,
} from '../zustand/map/selectMapData';
import {
    selectHeroCurrentHealth,
    selectHeroFacingDirection,
    selectHeroInitialFrame,
    selectHeroInitialPosition,
    selectHeroSetters,
} from '../zustand/hero/selectHeroData';
import { selectGameHeight, selectGameSetters, selectGameWidth } from '../zustand/game/selectGameData';

export const createAnimation = (animationManager, assetKey, animationName, frameQuantity, frameRate, repeat, yoyo) => {
    const frames = Array.from({ length: frameQuantity }).map((n, index) => ({
        key: assetKey,
        frame: `${animationName}_${(index + 1).toString().padStart(2, '0')}`,
    }));

    // console.log(frames);
    animationManager.create({
        key: `${assetKey}_${animationName}`,
        frames,
        frameRate,
        repeat,
        yoyo,
    });
};

export const handleCreateControls = (scene) => {
    // Controls
    // eslint-disable-next-line no-param-reassign
    scene.actionKey = scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.SPACE);
    // eslint-disable-next-line no-param-reassign
    scene.cursors = scene.input.keyboard.createCursorKeys();
    // eslint-disable-next-line no-param-reassign
    scene.wasd = scene.input.keyboard.addKeys({
        [UP_DIRECTION]: Input.Keyboard.KeyCodes.W,
        [DOWN_DIRECTION]: Input.Keyboard.KeyCodes.S,
        [LEFT_DIRECTION]: Input.Keyboard.KeyCodes.A,
        [RIGHT_DIRECTION]: Input.Keyboard.KeyCodes.D,
    });
};

export const handleCreateGroups = (scene) => {
    // Game groups
    // eslint-disable-next-line no-param-reassign
    scene.sprites = scene.add.group();
    // eslint-disable-next-line no-param-reassign
    scene.enemies = scene.add.group();
    // eslint-disable-next-line no-param-reassign
    scene.items = scene.add.group();
    // eslint-disable-next-line no-param-reassign
    scene.bombs = scene.add.group();
    // eslint-disable-next-line no-param-reassign
    scene.mapLayers = scene.add.group();
    // eslint-disable-next-line no-param-reassign
    scene.elements = scene.physics.add.staticGroup();
    // eslint-disable-next-line no-param-reassign
    scene.bombDestroyableElements = scene.physics.add.staticGroup();
};

export const findAdjacentMaps = (currentMap, maps) => maps.filter((map) => (
    (Math.abs(map.x - currentMap.x) === currentMap.width && map.y === currentMap.y) // left/right
        || (Math.abs(map.y - currentMap.y) === currentMap.height && map.x === currentMap.x) // up/down
        || (map.x === currentMap.x + currentMap.width && map.y === currentMap.y - currentMap.height) // up-right
        || (map.x === currentMap.x - currentMap.width && map.y === currentMap.y - currentMap.height) // up-left
        || (map.x === currentMap.x + currentMap.width && map.y === currentMap.y + currentMap.height) // down-right
        || (map.x === currentMap.x - currentMap.width && map.y === currentMap.y + currentMap.height) // down-left
));

export const getAdjacentMapsPositions = (currentMap, adjacentMaps) => adjacentMaps.reduce((adjacentMapObj, map) => {
    const dx = map.x - currentMap.x;
    const dy = map.y - currentMap.y;

    if (dx === -currentMap.width && dy === 0) { // left
        return { ...adjacentMapObj, left: map };
    }

    if (dx === currentMap.width && dy === 0) { // right
        return { ...adjacentMapObj, right: map };
    }

    if (dx === 0 && dy === -currentMap.height) { // up
        return { ...adjacentMapObj, up: map };
    }

    if (dx === 0 && dy === currentMap.height) { // down
        return { ...adjacentMapObj, down: map };
    }

    if (dx === currentMap.width && dy === -currentMap.height) { // up-right
        return { ...adjacentMapObj, up_right: map };
    }

    if (dx === -currentMap.width && dy === -currentMap.height) { // up-left
        return { ...adjacentMapObj, up_left: map };
    }

    if (dx === currentMap.width && dy === currentMap.height) { // down-right
        return { ...adjacentMapObj, down_right: map };
    }

    if (dx === -currentMap.width && dy === currentMap.height) { // down-left
        return { ...adjacentMapObj, down_left: map };
    }

    return adjacentMapObj;
}, {});

/**
 * @param scene
 * @returns Phaser.GameObjects.Group
 */
export const handleCreateMap = (scene) => {
    const currentMapKey = getSelectorData(selectCurrentMapKey);
    const tilesets = getSelectorData(selectTilesets(currentMapKey));
    const currentMapKeyData = getSelectorData(selectMapKeyData(currentMapKey));
    const worldData = getSelectorData(selectWorldData);
    const customColliders = scene.add.group();
    const adjacentMaps = findAdjacentMaps(currentMapKeyData, worldData.maps);
    const adjacentMapsPositions = getAdjacentMapsPositions(currentMapKeyData, adjacentMaps);

    return createTilemap(
        scene,
        currentMapKey,
        currentMapKeyData,
        tilesets,
        customColliders,
        adjacentMapsPositions
    );
};

export const createMapChangeTeleportObject = (
    scene,
    width,
    height,
    position,
    mapData,
    origin = { x: 0, y: 0 }
) => {
    const { fileName, width: mapWidth, height: mapHeight } = mapData;
    const targetMapKey = getFileNameWithoutExtension(fileName);

    const customCollider = createInteractiveGameObject(
        scene,
        position.x,
        position.y,
        width,
        height,
        origin
    );

    const overlapCollider = scene.physics.add.overlap(scene.heroSprite, customCollider, () => {
        scene.physics.world.removeCollider(overlapCollider);
        const facingDirection = getSelectorData(selectHeroFacingDirection);
        let targetTilePosition = {
            x: 1,
            y: 1,
        };

        switch (facingDirection) {
            case UP_DIRECTION: {
                targetTilePosition = {
                    x: Math.round(scene.heroSprite.x / TILE_WIDTH),
                    y: (mapHeight / TILE_HEIGHT) - 2,
                };

                break;
            }
            case DOWN_DIRECTION: {
                targetTilePosition = {
                    x: Math.round(scene.heroSprite.x / TILE_WIDTH),
                    y: 0,
                };

                break;
            }
            case LEFT_DIRECTION: {
                targetTilePosition = {
                    x: (mapWidth / TILE_WIDTH) - 2,
                    y: Math.round(scene.heroSprite.y / TILE_HEIGHT),
                };

                break;
            }
            case RIGHT_DIRECTION: {
                targetTilePosition = {
                    x: 0,
                    y: Math.round(scene.heroSprite.y / TILE_HEIGHT),
                };

                break;
            }
            default: {
                break;
            }
        }

        const {
            setHeroInitialFrame,
            setHeroFacingDirection,
            setHeroInitialPosition,
            setHeroPreviousPosition,
        } = getSelectorData(selectHeroSetters);
        const { setCurrentMapKey } = getSelectorData(selectMapSetters);

        setCurrentMapKey(targetMapKey);
        setHeroFacingDirection(facingDirection);
        setHeroInitialFrame(IDLE_FRAME.replace(IDLE_FRAME_POSITION_KEY, facingDirection));
        setHeroInitialPosition({ x: targetTilePosition.x, y: targetTilePosition.y });
        setHeroPreviousPosition({ x: targetTilePosition.x, y: targetTilePosition.y });

        const { setShouldPauseScene, setGameShowHeadsUpDisplay } = getSelectorData(selectGameSetters);
        setShouldPauseScene('GameScene', true);
        setGameShowHeadsUpDisplay(false);

        changeScene(scene, 'GameScene', {
            atlases: ['hero', 'sword', 'bomb'],
            images: [],
            mapKey: targetMapKey,
        }, {
            fadeType: 'out',
        });
    });
};

export const createTeleportTileObject = (scene, position, mapKey, targetTilePosition, type, margin = 3) => {
    const customCollider = createInteractiveGameObject(
        scene,
        position.x + margin,
        position.y - margin,
        TILE_WIDTH - margin * 2,
        TILE_HEIGHT - margin * 2,
        {
            x: 0,
            y: 1,
        }
    );

    const overlapCollider = scene.physics.add.overlap(scene.heroSprite, customCollider, () => {
        // console.log({
        //     overlapX: Math.abs(customCollider.body.overlapX),
        //     overlapY: Math.abs(customCollider.body.overlapY),
        //     // velocityX: Math.abs(scene.heroSprite.body.velocity.x),
        //     // velocityY: Math.abs(scene.heroSprite.body.velocity.y),
        // });
        // return;
        //
        // const yAxisMovement = [UP_DIRECTION, DOWN_DIRECTION].includes(facingDirection);
        // const xAxisMovement = [LEFT_DIRECTION, RIGHT_DIRECTION].includes(facingDirection);
        // if (xAxisMovement && Math.abs(customCollider.body.overlapX) < 10) {
        //     return;
        // }
        //
        // if (yAxisMovement && Math.abs(customCollider.body.overlapY) < 10) {
        //     return;
        // }

        // if (!((xAxisMovement && Math.abs(customCollider.body.overlapX) > 8) || (yAxisMovement && Math.abs(customCollider.body.overlapY) > 8))) {
        //     return;
        // }

        scene.physics.world.removeCollider(overlapCollider);
        const {
            setHeroInitialFrame,
            setHeroFacingDirection,
            setHeroInitialPosition,
            setHeroPreviousPosition,
        } = getSelectorData(selectHeroSetters);
        const { setCurrentMapKey } = getSelectorData(selectMapSetters);
        const facingDirection = getSelectorData(selectHeroFacingDirection);

        setCurrentMapKey(mapKey);
        setHeroFacingDirection(facingDirection);
        setHeroInitialFrame(IDLE_FRAME.replace(IDLE_FRAME_POSITION_KEY, facingDirection));
        setHeroInitialPosition({ x: targetTilePosition.x, y: targetTilePosition.y });
        setHeroPreviousPosition({ x: targetTilePosition.x, y: targetTilePosition.y });

        const { setShouldPauseScene, setGameShowHeadsUpDisplay } = getSelectorData(selectGameSetters);
        setShouldPauseScene('GameScene', true);
        setGameShowHeadsUpDisplay(false);

        changeScene(scene, 'GameScene', {
            atlases: ['hero', 'sword', 'bomb'],
            images: [],
            mapKey,
        }, {
            fadeType: 'out',
        });
    });
};

export const animateCanvasDayNightEffect = (
    scene,
    startSepia,
    startBrightness,
    endSepia,
    endBrightness,
    canvas,
    duration,
    onComplete
) => {
    const startTime = Date.now();

    const updateDayNightCycle = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1); // Limit progress to 1
        const sepia = startSepia + (endSepia - startSepia) * progress;
        const brightness = startBrightness + (endBrightness - startBrightness) * progress;
        // eslint-disable-next-line no-param-reassign
        canvas.style.filter = `sepia(${sepia}) brightness(${brightness})`;

        if (progress < 1) {
            scene.time.delayedCall(1, updateDayNightCycle);
        } else {
            scene.time.delayedCall(duration, onComplete);
        }
    };

    scene.time.delayedCall(1, updateDayNightCycle);
};

/**
 * @param scene
 * @param mapKey
 * @param mapData
 * @param tilesets
 * @param customColliders
 * @param adjacentMapsPositions
 * @returns Phaser.GameObjects.Group
 * TODO it's currently not possible to create a tilemap with custom positions
 */
export const createTilemap = (
    scene,
    mapKey,
    mapData,
    tilesets,
    customColliders,
    adjacentMapsPositions = {}
) => {
    // Create the map
    const map = scene.make.tilemap({ key: mapKey });
    // TODO check if tileset is already added
    tilesets.forEach((tilesetName) => {
        map.addTilesetImage(tilesetName, tilesetName);
    });

    // const tilesWithoutCollision = [];
    map.layers.forEach((layerData, idx) => {
        const layer = map.createLayer(
            layerData.name,
            tilesets,
            0,
            0
            // mapData.x,
            // mapData.y
        );

        const layerType = layerData.properties.find((property) => property.name === 'type')?.value;
        if (layerType === LAYER_TYPE_TERRAIN) {
            layer.setDepth(HERO_DEPTH - DEPTH_DIFF);
        } else {
            layer.setDepth(HERO_DEPTH + DEPTH_DIFF);
        }

        // const columnLength = layer.layer.data.length;
        layer.layer.data.forEach((tileRows, columnIndex) => {
            // const rowLength = tileRows.length;
            tileRows.forEach((tile, rowIndex) => {
                const {
                    index,
                    tileset,
                    properties,
                    x: tileX,
                    y: tileY,
                    // pixelX,
                    // pixelY,
                } = tile;

                const { collideLeft, collideRight, collideUp, collideDown } = properties;
                const shouldCollide = Boolean(collideLeft)
                    || Boolean(collideRight)
                    || Boolean(collideUp)
                    || Boolean(collideDown);

                // if (!shouldCollide) {
                //     tilesWithoutCollision.push(tile);
                // }

                if (index === -1) {
                    return;
                }

                if (isGrassTile(tile)) {
                    const gameObject = createGameObjectForTile(scene, tile);
                    gameObject.elementType = ELEMENT_GRASS_TYPE;
                    layer.removeTileAt(tileX, tileY);
                    gameObject.handleDestroyElement = () => {
                        const lifespan = 700;
                        const tex = generateAverageColorPixelTexture(scene, gameObject, 'grass');
                        const particles = scene.add.particles(tex);
                        particles.setDepth(Number.MAX_SAFE_INTEGER - 1);
                        const emitter = particles.createEmitter({
                            x: gameObject.body.x + Math.round(gameObject.body.width / 2),
                            y: gameObject.body.y + Math.round(gameObject.body.height / 2),
                            speed: { min: 20, max: 60 },
                            angle: { min: 0, max: 360 },
                            gravityY: 50,
                            lifespan,
                            // blendMode: 'ADD',
                            scale: { start: 1, end: 0 },
                            // quantity: 64,
                        });

                        gameObject.destroy();
                        emitter.explode(PhaserMath.Between(20, 35));
                    };

                    scene.elements.add(gameObject);

                    return;
                }

                if (isCrackedTile(tile)) {
                    const entranceSprite = createCaveEntrance(scene, tile);
                    entranceSprite.setAlpha(0);
                    entranceSprite.setDepth(HERO_DEPTH - DEPTH_DIFF);
                    const gameObject = createGameObjectForTile(scene, tile);
                    gameObject.elementType = ELEMENT_CRACK_TYPE;
                    gameObject.setDepth(HERO_DEPTH - DEPTH_DIFF);
                    layer.removeTileAt(tileX, tileY);
                    gameObject.entranceSprite = entranceSprite;

                    // scene.elements.add(gameObject);
                    scene.bombDestroyableElements.add(gameObject);

                    return;
                }

                // TODO create a function that checkes this
                // and also check for the tileset name I guess
                if (isBoxTile(tile)) {
                    // const gameObjects = layer.createFromTiles(
                    //     index,
                    //     -1,
                    //     { key: tileset.name, frame: index },
                    //     scene
                    // );

                    const gameObject = createGameObjectForTile(scene, tile);
                    gameObject.elementType = ELEMENT_BOX_TYPE;
                    layer.removeTileAt(tileX, tileY);

                    scene.elements.add(gameObject);
                    scene.bombDestroyableElements.add(gameObject);

                    return;
                }

                const tilesetCustomColliders = tileset?.getTileData?.(index);

                if (shouldCollide) {
                    properties[SHOULD_TILE_COLLIDE] = shouldCollide;
                }

                if (!layer.containsCollision) {
                    layer.containsCollision = shouldCollide;
                }

                if (tilesetCustomColliders) {
                    const { objectgroup } = tilesetCustomColliders;
                    const { objects } = objectgroup;

                    objects?.forEach((objectData) => {
                        let { height, width, x, y, ellipse } = objectData;

                        // if the custom collider is the same size as the tile
                        // then we enable the normal tile collider from Phaser
                        if (height === TILE_HEIGHT && width === TILE_WIDTH) {
                            tile.setCollision(
                                Boolean(collideLeft),
                                Boolean(collideRight),
                                Boolean(collideUp),
                                Boolean(collideDown)
                            );

                            return;
                        }

                        const { rotation, flipX, flipY } = tile;
                        if (flipX) {
                            x = TILE_WIDTH - (x + width);
                        }
                        if (flipY) {
                            y = TILE_HEIGHT - (y + height);
                        }

                        const degree = getDegreeFromRadians(rotation);
                        [x, y, width, height] = rotateRectangleInsideTile(x, y, width, height, degree);

                        const customCollider = createInteractiveGameObject(
                            scene,
                            tile.x * TILE_WIDTH + x,
                            tile.y * TILE_HEIGHT + y,
                            width,
                            height
                        );

                        customColliders.add(customCollider);
                    });
                } else {
                    tile.setCollision(
                        Boolean(collideLeft),
                        Boolean(collideRight),
                        Boolean(collideUp),
                        Boolean(collideDown)
                    );
                }
            });
        });

        // scene.physics.add.collider(scene.heroSprite, customColliders);
        // layer.setCollisionByProperty({ collides: true });
        scene.mapLayers.add(layer);
    });

    // const layersWithCollision = scene.mapLayers.getChildren().filter((layer) => layer.containsCollision);
    // const tilesWithCollision = layersWithCollision.flatMap(
    //     (layer) => layer.layer.data.flat().filter((tile, idx) => tile?.properties?.[SHOULD_TILE_COLLIDE])
    // );

    // tilesWithoutCollision.forEach((tile) => {
    //     const { height, width } = mapData;
    //     const { pixelX, pixelY, x: tileX, y: tileY } = tile;
    //     if (adjacentMapsPositions.right && pixelX === width - TILE_WIDTH) {
    //         const { fileName } = adjacentMapsPositions.right;
    //         const targetMapKey = getFileNameWithoutExtension(fileName);
    //         createTeleportTileObject(
    //             scene,
    //             { x: pixelX + TILE_WIDTH, y: pixelY + TILE_HEIGHT },
    //             targetMapKey,
    //             { x: 0, y: tileY - 1 }
    //         );
    //     } else if (adjacentMapsPositions.left && pixelX === 0) {
    //         const { fileName, width } = adjacentMapsPositions.left;
    //         const targetMapKey = getFileNameWithoutExtension(fileName);
    //         createTeleportTileObject(
    //             scene,
    //             { x: pixelX - TILE_WIDTH, y: pixelY + TILE_HEIGHT },
    //             targetMapKey,
    //             { x: (width / TILE_WIDTH) - 2, y: tileY - 1 }
    //         );
    //     }
    // });

    const { width: mapWidth, height: mapHeight } = mapData;
    if (adjacentMapsPositions.right) {
        createMapChangeTeleportObject(
            scene,
            TILE_WIDTH,
            mapHeight,
            { x: mapWidth, y: 0 },
            adjacentMapsPositions.right
        );
    }

    if (adjacentMapsPositions.left) {
        createMapChangeTeleportObject(
            scene,
            TILE_WIDTH,
            mapHeight,
            { x: -TILE_WIDTH, y: 0 },
            adjacentMapsPositions.left
        );
    }

    if (adjacentMapsPositions.up) {
        createMapChangeTeleportObject(
            scene,
            mapWidth,
            TILE_HEIGHT,
            { x: 0, y: -TILE_HEIGHT },
            adjacentMapsPositions.up
        );
    }

    if (adjacentMapsPositions.down) {
        createMapChangeTeleportObject(
            scene,
            mapWidth,
            TILE_HEIGHT,
            { x: 0, y: mapHeight },
            adjacentMapsPositions.down
        );
    }

    scene.gridEngine.create(map, {
        characters: [],
        collisionTilePropertyName: SHOULD_TILE_COLLIDE,
    });

    // eslint-disable-next-line no-param-reassign
    scene.map = map;

    return customColliders;
};

export const isGrassTile = (tile) => {
    const { index, tileset } = tile;
    const { name, firstgid } = tileset;
    const tileIndex = index - firstgid;

    switch (name) {
        case 'field_01': {
            return [173, 174, 175, 176, 177, 178].includes(tileIndex);
        }

        default: {
            return false;
        }
    }
};

export const isBoxTile = (tile) => {
    const { index, tileset } = tile;
    const { name, firstgid } = tileset;
    const tileIndex = index - firstgid;

    switch (name) {
        case 'village_01': {
            return [261, 293, 325, 357].includes(tileIndex);
        }

        default: {
            return false;
        }
    }
};

export const isCrackedTile = (tile) => {
    const { index, tileset } = tile;
    const { name, firstgid } = tileset;
    const tileIndex = index - firstgid;

    switch (name) {
        case 'custom_tileset': {
            return [0, 1].includes(tileIndex);
        }

        default: {
            return false;
        }
    }
};

// TODO add option for dark or light entrance
export const createCaveEntrance = (scene, tile) => {
    const tileData = {
        index: 1634,
        tileset: {
            name: 'mountains_01',
            firstgid: 1459,
        },
        properties: {},
        pixelX: tile.pixelX,
        pixelY: tile.pixelY,
    };

    return createGameObjectForTile(scene, tileData);
};

export const createGameObjectForTile = (scene, tile) => {
    const { index, tileset, properties, pixelX, pixelY } = tile;
    const gameObject = scene.physics.add.staticSprite(
        pixelX,
        pixelY,
        tileset.name
    ).setOrigin(0, 0);
    // gameObjects.setImmovable(true);

    const columns = gameObject.width / TILE_WIDTH;
    // const rows = gameObject.height / TILE_HEIGHT;
    const tileIndex = index - tileset.firstgid;
    const x = (tileIndex % columns) * TILE_WIDTH;
    const y = Math.round(tileIndex / columns) * TILE_HEIGHT;
    // const y = (Math.floor((tileIndex - 1) / columns) + 1) * TILE_HEIGHT;

    gameObject.body.width = TILE_WIDTH;
    gameObject.body.height = TILE_HEIGHT;
    // gameObjects.body.setOffset(x, y);
    gameObject.body.setOffset(gameObject.width / 2, gameObject.height / 2);

    gameObject.setCrop(x, y, TILE_WIDTH, TILE_HEIGHT);
    gameObject.setPosition(gameObject.x - x, gameObject.y - y);

    return gameObject;
};

export const handleCreateEnemy = (scene, spriteName, position, enemyType, enemyFamily, enemyHealth) => {
    // Create slime sprite
    const enemySprite = scene.physics.add
        .sprite(position.x, position.y, SLIME_SPRITE_NAME)
        .setName(spriteName)
        .setOrigin(0, 0);

    updateSpriteDepthBasedOnHeroPosition(scene, enemySprite);
    enemySprite.body.setCircle(6);
    enemySprite.body.setOffset(enemySprite.body.width / 2, enemySprite.body.height + 1);
    enemySprite.behaviour = PATROL_BEHAVIOUR;
    enemySprite.totalHealth = enemyHealth;
    enemySprite.currentHealth = enemyHealth;
    enemySprite.enemyFamily = enemyFamily;
    enemySprite.enemyType = enemyType;

    enemySprite.update = (time, delta) => {
        updateSpriteDepthBasedOnHeroPosition(scene, enemySprite);
        if (enemySprite.body.overlapR < 10 && enemySprite.body.overlapR > 0) {
            enemySprite.behaviour = PATROL_BEHAVIOUR;
        }
    };

    const [calculateEnemyFollowPaths, timeOutFunctionId] = getCalculateEnemyFollowPaths(scene, enemySprite);
    enemySprite.handleEnemyStoppedMoving = () => {
        if (enemySprite.isTakingDamage) {
            timeOutFunctionId?.remove?.();
            return;
        }

        calculateEnemyFollowPaths();
    };

    enemySprite.handleStopTakingDamage = () => {
        enemySprite.isTakingDamage = false;
        calculateEnemyFollowPaths();
    };

    enemySprite.handlePerceptedHero = () => {
        enemySprite.behaviour = FOLLOW_BEHAVIOUR;
        calculateEnemyFollowPaths();
    };

    const enemyImage = scene.add.image(
        enemySprite.x,
        enemySprite.y,
        SLIME_SPRITE_NAME,
        enemySprite.frame.name
    )
        .setOrigin(0.2, 0.35)
        .setDepth(enemySprite.depth)
        .setAlpha(0);

    enemySprite.handleTakeDamage = (damage, attackDirection) => {
        enemySprite.currentHealth -= damage;

        // Display damage number
        displayDamageNumber(scene, enemySprite, damage);

        if (enemySprite.currentHealth <= 0) {
            const emitter = createEnemyDeathAnimation(scene, enemySprite);
            scene.gridEngine.stopMovement(spriteName);
            scene.tweens.add({
                targets: enemySprite,
                duration: 70,
                scale: 1.5,
                alpha: 0.5,
                ease: 'Power1',
                onComplete: () => {
                    emitter.explode(PhaserMath.Between(20, 35));
                    scene.gridEngine.removeCharacter(spriteName);
                    enemySprite.destroy(true);
                    enemyImage.destroy(true);
                    // canvas.destroy();
                },
            });

            return;
        }

        // const attackAnimation = scene.anims.anims.get('hero_attack_down');
        // const attackAnimationDuration = attackAnimation.duration; // / attackAnimation.frameRate;
        const animationDuration = 90;

        const pos = scene.gridEngine.getPosition(spriteName);
        scene.gridEngine.stopMovement(spriteName);
        scene.gridEngine.setSpeed(spriteName, 20);
        enemyImage.setPosition(enemySprite.x + (enemySprite.body.width / 2), enemySprite.y);
        enemyImage.setFrame(enemySprite.frame.name);

        // TODO there is a bug when you hit the enemy again right after hitting it, it will cancel the blinking animation
        enemySprite.setAlpha(0);
        enemyImage.setAlpha(1);

        switch (attackDirection) {
            case 'attack_up_01': {
                const newPos = {
                    x: pos.x,
                    y: pos.y - 1,
                };

                if (scene.gridEngine.isTileBlocked(newPos)) {
                    enemySprite.setAlpha(1);
                    enemyImage.setAlpha(0);
                    break;
                }

                enemySprite.anims.play(`${SLIME_SPRITE_NAME}_walk_down`);
                scene.gridEngine.setPosition(spriteName, newPos);

                scene.tweens.add({
                    targets: enemyImage,
                    duration: animationDuration,
                    x: pos.x * TILE_WIDTH,
                    y: (pos.y - 1) * TILE_HEIGHT,
                    ease: 'Power1',
                });

                break;
            }
            case 'attack_right_01': {
                const newPos = {
                    x: pos.x + 1,
                    y: pos.y,
                };

                if (scene.gridEngine.isTileBlocked(newPos)) {
                    enemySprite.setAlpha(1);
                    enemyImage.setAlpha(0);
                    break;
                }

                enemySprite.anims.play(`${SLIME_SPRITE_NAME}_walk_left`);
                scene.gridEngine.setPosition(spriteName, newPos);

                scene.tweens.add({
                    targets: enemyImage,
                    duration: animationDuration,
                    x: (pos.x + 1) * TILE_WIDTH,
                    y: pos.y * TILE_HEIGHT,
                    ease: 'Power1',
                });

                break;
            }
            case 'attack_down_01': {
                const newPos = {
                    x: pos.x,
                    y: pos.y + 1,
                };

                if (scene.gridEngine.isTileBlocked(newPos)) {
                    enemySprite.setAlpha(1);
                    enemyImage.setAlpha(0);
                    break;
                }

                enemySprite.anims.play(`${SLIME_SPRITE_NAME}_walk_up`);
                scene.gridEngine.setPosition(spriteName, newPos);

                scene.tweens.add({
                    targets: enemyImage,
                    duration: animationDuration,
                    x: pos.x * TILE_WIDTH,
                    y: (pos.y + 1) * TILE_HEIGHT,
                    ease: 'Power1',
                });

                break;
            }
            case 'attack_left_01':
            default: {
                const newPos = {
                    x: pos.x - 1,
                    y: pos.y,
                };

                if (scene.gridEngine.isTileBlocked(newPos)) {
                    enemySprite.setAlpha(1);
                    enemyImage.setAlpha(0);
                    break;
                }

                enemySprite.anims.play(`${SLIME_SPRITE_NAME}_walk_right`);
                scene.gridEngine.setPosition(spriteName, newPos);

                scene.tweens.add({
                    targets: enemyImage,
                    duration: animationDuration,
                    x: (pos.x - 1) * TILE_WIDTH,
                    y: pos.y * TILE_HEIGHT,
                    ease: 'Power1',
                });

                break;
            }
        }

        // Add blinking effect
        createBlinkingEffect(
            scene,
            enemyImage,
            Math.floor(animationDuration / 3),
            () => {
                enemySprite.setAlpha(1);
                enemyImage.setAlpha(0);
            }
        );
    };

    enemySprite.onAttackOverlap = (attackSprite, enemySprite) => {
        if (
            enemySprite.isTakingDamage
            || !attackSprite.visible
            || attackSprite.enemies.includes(enemySprite)
        ) {
            return;
        }

        // eslint-disable-next-line no-param-reassign
        enemySprite.isTakingDamage = true;
        enemySprite.handleTakeDamage(10, attackSprite.frame.name);
        attackSprite.enemies.push(enemySprite);

        // scene.gridEngine.stopMovement(spriteName);
        // const position = scene.gridEngine.getPosition(spriteName);
    };

    enemySprite.onPresenceOverlap = (presencePerceptionCircle, enemySprite) => {
        if (enemySprite.body.overlapR > 100 && enemySprite.behaviour !== FOLLOW_BEHAVIOUR) {
            enemySprite.handlePerceptedHero();
        }
    };

    scene.gridEngine.addCharacter({
        id: spriteName,
        sprite: enemySprite,
        speed: 1,
        startPosition: {
            x: position.x / TILE_WIDTH,
            y: position.y / TILE_HEIGHT,
        },
        // offsetY: 4,
    });
    scene.gridEngine.moveRandomly(spriteName, 2000, 2);

    scene.enemies.add(enemySprite);

    // Create enemy animation
    handleCreateEnemyAnimations(scene, enemySprite);
};

export const generateColorPixelTexture = (scene, color, textureName, width = 2, height = 2) => {
    let texture = scene.textures.get(textureName);
    if (texture.key !== textureName) {
        generateTextureFromColor(scene, color, textureName, width, height);
        texture = scene.textures.get(textureName);
    }

    return texture;
};

export const generateAverageColorPixelTexture = (scene, sprite, textureName) => {
    // const tex = scene.textures.get('slime');
    // let newTexture = tex.generateTexture('new', tex.width, tex.height);
    const tex = scene.textures.get(textureName);
    if (tex.key === textureName) {
        return tex;
    }

    // const pixels = scene.textures.getPixel(16, 16, enemyImage.texture.key);
    // const hexColor = Display.Color.RGBToString(pixels.r, pixels.g, pixels.b);

    const source = sprite.texture.getSourceImage(); // enemyImage
    const canvas = scene.textures.createCanvas(PhaserMath.RND.uuid(), source.width, source.height);
    canvas.draw(0, 0, source);
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    canvas.destroy();

    let totalRed = 0;
    let totalGreen = 0;
    let totalBlue = 0;
    const numPixels = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
        totalRed += pixels[i];
        totalGreen += pixels[i + 1];
        totalBlue += pixels[i + 2];
    }

    const avgRed = totalRed / numPixels;
    const avgGreen = totalGreen / numPixels;
    const avgBlue = totalBlue / numPixels;
    const avgColor = Display.Color.GetColor(avgRed, avgGreen, avgBlue);

    // const intColor = Number.parseInt(avgColor.replace('#', '0x'), 10);
    generateTextureFromColor(scene, avgColor, textureName);

    return scene.textures.get(textureName);
};

export const generateTextureFromColor = (scene, color, textureName, width = 2, height = 2) => {
    const graphics = scene.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, width, height);
    return graphics.generateTexture(textureName, width, height);
    // scene.textures.addTexture(texture);
};

export const createEnemyDeathAnimation = (scene, enemySprite) => {
    const tex = generateAverageColorPixelTexture(scene, enemySprite, 'blue-pixel');
    const particles = scene.add.particles(tex);
    particles.setDepth(Number.MAX_SAFE_INTEGER - 1);
    const emitter = particles.createEmitter({
        x: enemySprite.x + Math.round(enemySprite.width / 2),
        y: enemySprite.y + Math.round(enemySprite.height / 2),
        speed: { min: 50, max: 200 },
        angle: { min: 0, max: 360 },
        gravityY: 50,
        lifespan: 350,
        blendMode: 'ADD',
        scale: { start: 1, end: 0 },
        // quantity: 64,
    });

    emitter.onParticleDeath((particle) => {
        emitter.active = false;
        particles.destroy();
    });

    return emitter;
};

export const updateSpriteDepthBasedOnHeroPosition = (scene, sprite) => {
    const { heroSprite } = scene;

    const spriteBounds = sprite.getBounds();
    const heroBounds = heroSprite.getBounds();

    if (spriteBounds.bottom - 1 <= heroBounds.bottom) {
        if (sprite.depth > HERO_DEPTH) {
            sprite.setDepth(HERO_DEPTH - DEPTH_DIFF);
        }
    } else if (sprite.depth < HERO_DEPTH) {
        sprite.setDepth(HERO_DEPTH + DEPTH_DIFF);
    }
};

export const subscribeToGridEngineEvents = (scene) => {
    scene.gridEngine.movementStopped().subscribe(({ charId, direction }) => {
        if (charId.includes(ENEMY_SPRITE_PREFIX)) {
            const enemySprite = scene.enemies.getChildren().find(({ name }) => name === charId);

            if (enemySprite) {
                enemySprite.handleEnemyStoppedMoving();
            }
        }
    });

    scene.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
        if (charId.includes(ENEMY_SPRITE_PREFIX)) {
            const enemySprite = scene.enemies.getChildren().find(({ name }) => name === charId);

            if (enemySprite && !enemySprite.isTakingDamage) {
                enemySprite.anims.play(`${SLIME_SPRITE_NAME}_walk_${direction}`);
            }
        }
    });
};

export const getCalculateEnemyFollowPaths = (scene, enemySprite) => {
    let timeOutFunctionId;
    const calculateEnemyFollowPaths = () => {
        // console.log('running thiiis', ((new Error()).stack.split('\n')[2].trim().split(' ')[2]));
        const allEnemies = scene.gridEngine.getAllCharacters();

        timeOutFunctionId?.remove?.();
        timeOutFunctionId = null;

        if (!allEnemies.includes(enemySprite.name) || !enemySprite || enemySprite.isTakingDamage) {
            return;
        }

        if (enemySprite.behaviour !== FOLLOW_BEHAVIOUR) {
            // scene.gridEngine.stopMovement(enemySprite.name);
            scene.gridEngine.moveRandomly(enemySprite.name, 2000, 4);
            scene.gridEngine.setSpeed(enemySprite.name, 1);
            return;
        }

        const distance = PhaserMath.Distance.Between(
            scene.heroSprite.x,
            scene.heroSprite.y,
            enemySprite.x,
            enemySprite.y
        );

        const movement = scene.gridEngine.getMovement(enemySprite.name);
        if (
            (!scene.gridEngine.isMoving(enemySprite.name) && movement.type === 'Target')
            && distance < (TILE_HEIGHT * TILE_WIDTH) / 2
        ) {
            scene.gridEngine.moveRandomly(enemySprite.name, 10, 1);
        } else {
            scene.gridEngine.setSpeed(enemySprite.name, 2);
            scene.gridEngine.moveTo(enemySprite.name, {
                x: Math.round(scene.heroSprite.x / TILE_WIDTH),
                y: Math.round(scene.heroSprite.y / TILE_HEIGHT),
            });
        }

        timeOutFunctionId = scene.time.delayedCall(1000, () => {
            calculateEnemyFollowPaths();
        });
    };

    return [calculateEnemyFollowPaths, timeOutFunctionId];
};

export const createBlinkingEffect = (scene, targetSprite, duration, handleOnComplete) => {
    scene.tweens.add({
        targets: targetSprite,
        alpha: 0,
        duration,
        ease: 'Power1',
        repeat: 3,
        yoyo: true,
        onComplete: () => {
            handleOnComplete?.();
        },
    });
};

export const displayDamageNumber = (scene, targetSprite, damage) => {
    const damageNumber = scene.add.text(
        targetSprite.x + 10,
        targetSprite.y + 5,
        `-${damage}`,
        { fontFamily: '"Press Start 2P"', fontSize: 8, color: '#ff0000' }
    )
        .setOrigin(0.5)
        .setDepth(UI_DEPTH);

    scene.tweens.add({
        targets: damageNumber,
        alpha: 0,
        duration: 1000,
        onUpdate: (tween, target) => {
            damageNumber.x = targetSprite.x + 10;
            damageNumber.y = targetSprite.y + 5 - tween.totalProgress * 5;
        },
        onComplete: () => {
            damageNumber.destroy();

            // by the time the tween is over
            // the sprite might have been deleted already
            targetSprite?.anims?.stop?.();
        },
    });
};

export const handleCreateBomb = (scene, heroSprite) => {
    const position = {
        x: heroSprite.x + heroSprite.body.width / 2,
        y: heroSprite.y + heroSprite.body.height - 4,
    };

    const bombSprite = scene.physics.add
        .sprite(position.x, position.y, BOMB_SPRITE_NAME)
        .setName(BOMB_SPRITE_NAME)
        .setOrigin(0, 0)
        .setDepth(ITEM_DEPTH);

    const explosionCollider = createInteractiveGameObject(
        scene,
        bombSprite.x - bombSprite.body.width / 2 - 1,
        bombSprite.y - bombSprite.body.height / 2,
        TILE_WIDTH * 2,
        TILE_HEIGHT * 2,
        { x: 0, y: 0 },
        true
    );

    bombSprite.body.setImmovable(true);
    bombSprite.body.width = TILE_WIDTH - 4;
    bombSprite.body.height = TILE_HEIGHT - 4;
    bombSprite.body.setOffset(1, 3);
    updateSpriteDepthBasedOnHeroPosition(scene, bombSprite);
    bombSprite.update = (time, delta) => {
        updateSpriteDepthBasedOnHeroPosition(scene, bombSprite);
    };

    handleCreateItemAnimations(scene, bombSprite, BOMB_SPRITE_NAME);
    bombSprite.anims.play('bomb_idle');

    // TODO because need to make this look better
    const orangeColor = Display.Color.GetColor(255, 135, 64);
    const orangeTexture = generateColorPixelTexture(scene, orangeColor, 'TODO_explosion_orange');
    const yellowColor = Display.Color.GetColor(255, 231, 64);
    const yellowTexture = generateColorPixelTexture(scene, yellowColor, 'TODO_explosion_yellow');

    scene.time.delayedCall(200, () => {
        // console.time('bomb');
        const speedUpTween = scene.tweens.add({
            targets: bombSprite,
            alpha: 0.3,
            duration: 200,
            yoyo: true,
            repeat: 15,
            ease: 'Linear',
            loop: 0,
            onStart: () => {
                speedUpTween.timeScale = 1;
            },
            onRepeat: () => {
                speedUpTween.timeScale += 0.08;
            },
            onComplete: () => {
                // console.timeEnd('bomb');
                let hasExploded = false;
                // explosionCollider.body.setVelocity(1, 1);
                const enemiesOverlap = scene.physics.overlap(
                    explosionCollider,
                    scene.enemies,
                    (explosion, enemySprite) => {
                        if (!hasExploded) {
                            enemySprite.handleTakeDamage(20, null);
                        }
                    }
                );

                const onExplosionEmitterStartedCallbacks = [];
                const elementsOverlap = scene.physics.overlap(
                    explosionCollider,
                    scene.bombDestroyableElements,
                    (explosion, elementSprite) => {
                        if (!hasExploded) {
                            // TODO add destroy animation
                            // and check if element should be destroyed or not
                            elementSprite.destroy();
                            switch (elementSprite.elementType) {
                                case ELEMENT_CRACK_TYPE: {
                                    const tilesAtPosition = scene.mapLayers.getChildren().reduce((tiles, layer) => {
                                        const tile = scene.map.getTileAtWorldXY(
                                            elementSprite.x,
                                            elementSprite.y,
                                            false,
                                            undefined,
                                            layer
                                        );

                                        if (tile) {
                                            return [...tiles, tile];
                                        }

                                        return tiles;
                                    }, []);

                                    onExplosionEmitterStartedCallbacks.push(() => {
                                        tilesAtPosition.forEach((tile) => tile.setCollision(false));
                                        elementSprite.entranceSprite.setAlpha(1);
                                    });

                                    break;
                                }
                                case ELEMENT_BOX_TYPE: {
                                    // TODO
                                    break;
                                }
                                default: {
                                    // TODO
                                    break;
                                }
                            }
                        }
                    }
                );

                scene.tweens.add({
                    targets: bombSprite,
                    x: bombSprite.x - Math.round(bombSprite.body.width / 2),
                    y: bombSprite.y - Math.round(bombSprite.body.height / 2),
                    duration: 40,
                    scale: 1.5,
                    alpha: 0.5,
                    ease: 'Power1',
                    onComplete: () => {
                        hasExploded = true;
                        const emitterConfig = {
                            x: bombSprite.x + Math.round(bombSprite.width / 2),
                            y: bombSprite.y + Math.round(bombSprite.height / 2),
                            quantity: { min: 50, max: 150 },
                            speed: { min: 50, max: 200 },
                            angle: { min: 0, max: 360 },
                            gravityY: 50,
                            lifespan: 350,
                            // blendMode: 'ADD',
                            scale: { start: 1, end: 0 },
                        };

                        const orangeExplosionParticles = scene.add.particles(orangeTexture.key);
                        orangeExplosionParticles.setDepth(Number.MAX_SAFE_INTEGER - 1);
                        const orangeExplosionEmitter = orangeExplosionParticles.createEmitter(emitterConfig);
                        orangeExplosionEmitter.explode();

                        const yellowExplosionParticles = scene.add.particles(yellowTexture.key);
                        yellowExplosionParticles.setDepth(Number.MAX_SAFE_INTEGER - 1);
                        const yellowExplosionEmitter = yellowExplosionParticles.createEmitter(emitterConfig);
                        yellowExplosionEmitter.explode();

                        bombSprite.destroy();
                        scene.time.delayedCall(10, () => {
                            explosionCollider.destroy();
                            scene.physics.world.removeCollider(enemiesOverlap);
                            scene.physics.world.removeCollider(elementsOverlap);
                            onExplosionEmitterStartedCallbacks.forEach((callback) => callback());
                        });
                    },
                });
            },
        });
    });

    scene.bombs.add(bombSprite);
};

export const handleCreateHero = (scene) => {
    const initialFrame = getSelectorData(selectHeroInitialFrame);
    const initialPosition = getSelectorData(selectHeroInitialPosition);
    const { x, y } = initialPosition;

    // Create hero sprite
    const heroSprite = scene.physics.add
        .sprite(x * TILE_WIDTH, y * TILE_HEIGHT, HERO_SPRITE_NAME, initialFrame)
        .setName(HERO_SPRITE_NAME)
        .setOrigin(0, 0)
        .setDepth(HERO_DEPTH);

    // eslint-disable-next-line operator-assignment
    // heroSprite.body.width = heroSprite.body.width / 2;
    // eslint-disable-next-line operator-assignment
    // heroSprite.body.height = heroSprite.body.height / 2;
    heroSprite.body.setCircle(heroSprite.body.width / 4);
    heroSprite.body.setOffset(heroSprite.body.width / 2, heroSprite.body.height);

    // Create attack animation
    heroSprite.attackSprite = scene.physics.add
        .sprite(x * TILE_WIDTH, y * TILE_HEIGHT, SWORD_SPRITE_NAME)
        .setName(SWORD_SPRITE_NAME)
        .setOrigin(0, 0)
        .setVisible(false)
        .setDepth(HERO_DEPTH);

    // eslint-disable-next-line operator-assignment
    heroSprite.attackSprite.body.width = 20;
    // eslint-disable-next-line operator-assignment
    heroSprite.attackSprite.body.height = 20;
    heroSprite.attackSprite.enemies = [];

    // const facingDirection = getSelectorData(selectHeroFacingDirection);
    // heroSprite.setFrame(
    //     IDLE_FRAME.replace(IDLE_FRAME_POSITION_KEY, facingDirection)
    // );

    heroSprite.actionCollider = createInteractiveGameObject(
        scene,
        heroSprite.x + heroSprite.body.width / 2,
        heroSprite.y + heroSprite.height,
        heroSprite.body.width,
        TILE_HEIGHT / 2
    );

    // const canvas = scene.textures.createCanvas('transparent', 1, 1);
    // const context = canvas.getContext('2d');
    // context.clearRect(0, 0, canvas.width, canvas.height);
    // const sprite = scene.physics.add.sprite(
    //     heroSprite.x + heroSprite.body.width / 2,
    //     heroSprite.y + heroSprite.height,
    //     'slime'
    // );
    // sprite.setSize(heroSprite.body.width, TILE_HEIGHT / 2);
    // heroSprite.actionCollider = sprite;

    // heroSprite.attackCollider = createInteractiveGameObject(
    //     scene,
    //     0,
    //     0,
    //     TILE_WIDTH,
    //     TILE_HEIGHT
    // );

    // hero presence
    heroSprite.presencePerceptionCircle = createInteractiveGameObject(
        scene,
        heroSprite.x,
        heroSprite.y,
        TILE_WIDTH * 26,
        TILE_HEIGHT * 26,
        { x: 0, y: 0 },
        true
    );

    const updatePresencePerceptionCircle = () => {
        heroSprite.presencePerceptionCircle.setX(
            heroSprite.x - Math.round(heroSprite.presencePerceptionCircle.width / 2 - heroSprite.width / 2)
        );
        heroSprite.presencePerceptionCircle.setY(
            heroSprite.y - Math.round(heroSprite.presencePerceptionCircle.height / 2 - heroSprite.height / 2) + 6
        );
    };

    const updateActionCollider = ({ top, right, bottom, left, width, height } = heroSprite.body) => {
        const facingDirection = getSelectorData(selectHeroFacingDirection);

        switch (facingDirection) {
            case DOWN_DIRECTION: {
                heroSprite.actionCollider.body.width = heroSprite.body.width;
                heroSprite.actionCollider.body.height = TILE_HEIGHT / 2;
                heroSprite.actionCollider.setX(left);
                heroSprite.actionCollider.setY(bottom);

                break;
            }

            case UP_DIRECTION: {
                heroSprite.actionCollider.body.width = heroSprite.body.width;
                heroSprite.actionCollider.body.height = TILE_HEIGHT / 2;
                heroSprite.actionCollider.setX(left);
                heroSprite.actionCollider.setY(top - heroSprite.actionCollider.body.height);

                break;
            }

            case LEFT_DIRECTION: {
                heroSprite.actionCollider.body.height = heroSprite.body.height;
                heroSprite.actionCollider.body.width = TILE_WIDTH / 2;
                heroSprite.actionCollider.setX(left - heroSprite.actionCollider.body.width);
                heroSprite.actionCollider.setY(top);

                break;
            }

            case RIGHT_DIRECTION: {
                heroSprite.actionCollider.body.height = heroSprite.body.height;
                heroSprite.actionCollider.body.width = TILE_WIDTH / 2;
                heroSprite.actionCollider.setX(right);
                heroSprite.actionCollider.setY(top);

                break;
            }

            default: {
                break;
            }
        }
    };

    heroSprite.handleTakeDamage = (damage, enemySprite, heroEnemyOverlap, shouldMoveHero = false) => {
        if (
            heroSprite.body.overlapR === enemySprite.body.overlapR
            && heroSprite.body.overlapR < 5
        ) {
            return;
        }

        if (heroSprite.isTakingDamage) {
            return;
        }

        const { setHeroCurrentHealth } = getSelectorData(selectHeroSetters);
        const currentHealth = getSelectorData(selectHeroCurrentHealth);
        const newHealth = setHeroCurrentHealth(currentHealth - damage);

        // eslint-disable-next-line no-param-reassign
        heroEnemyOverlap.active = false;

        // eslint-disable-next-line no-param-reassign
        heroSprite.isTakingDamage = true;

        // Calculate the x and y positions relative to the enemySprite
        const deltaX = enemySprite.x - heroSprite.x;
        const deltaY = enemySprite.y - heroSprite.y;

        // Check if deltaX is positive or negative and multiply by 1 or -1 accordingly
        const newX = heroSprite.x - (deltaX > 0 ? 1 : -1) * TILE_WIDTH / 2;
        // Check if deltaY is positive or negative and multiply by 1 or -1 accordingly
        const newY = heroSprite.y - (deltaY > 0 ? 1 : -1) * TILE_HEIGHT / 2;

        // Display damage number
        displayDamageNumber(
            scene,
            heroSprite,
            Math.abs(newHealth - currentHealth)
        );

        // Add blinking effect
        createBlinkingEffect(
            scene,
            heroSprite,
            50,
            () => {
                heroSprite.setAlpha(1);
                // eslint-disable-next-line no-param-reassign
                heroEnemyOverlap.active = true;
                // eslint-disable-next-line no-param-reassign
                heroSprite.isTakingDamage = false;
                heroSprite.body.setVelocity(0, 0);
                updateActionCollider();
                updatePresencePerceptionCircle();
            }
        );

        if (shouldMoveHero) {
            // Create the tween animation to move the heroSprite
            scene.tweens.add({
                targets: heroSprite,
                x: newX,
                y: newY,
                ease: 'Power1',
                duration: 40,
                onUpdate: () => {
                    updateActionCollider();
                    updatePresencePerceptionCircle();
                    scene.heroSprite.attackSprite.update?.();
                    // scene.physics.moveTo(heroSprite, heroSprite.x, heroSprite.y);
                    scene.heroSprite.body.setVelocity(1, 1); // TODO maybe
                },
                onComplete: () => {
                    updateActionCollider();
                    updatePresencePerceptionCircle();
                },
            });
        }
    };

    updatePresencePerceptionCircle();
    updateActionCollider({
        top: heroSprite.y + (heroSprite.height - heroSprite.body.height),
        right: heroSprite.x + heroSprite.width - (heroSprite.width - heroSprite.body.width) / 2,
        bottom: heroSprite.y + heroSprite.height,
        left: heroSprite.x + (heroSprite.width - heroSprite.body.width) / 2,
    });

    heroSprite.update = (time, delta) => {
        if (heroSprite.body.velocity.y === 0 && heroSprite.body.velocity.x === 0) {
            heroSprite.x = PhaserMath.Snap.To(heroSprite.x, 1);
            heroSprite.y = PhaserMath.Snap.To(heroSprite.y, 1);

            return;
        }

        heroSprite.attackSprite.update?.();
        updatePresencePerceptionCircle();
    };

    heroSprite.updateActionCollider = updateActionCollider;

    let lastEvent = 'overlapend';
    heroSprite.actionCollider.update = (time, delta) => {
        const touching = !heroSprite.actionCollider.body.touching.none;
        const wasTouching = !heroSprite.actionCollider.body.wasTouching.none;
        const { actionCollider } = heroSprite;
        const { embedded } = actionCollider.body;
        const hasVelocity = actionCollider.body.velocity.x !== 0
            || actionCollider.body.velocity.y !== 0;

        if (lastEvent !== 'overlapstart' && ((hasVelocity && touching && !wasTouching) || embedded)) {
            lastEvent = 'overlapstart';
            actionCollider.emit(lastEvent);
        } else if (lastEvent !== 'overlapend' && ((hasVelocity && !touching && wasTouching) || !embedded)) {
            lastEvent = 'overlapend';
            actionCollider.emit(lastEvent);
        }
    };

    // eslint-disable-next-line no-param-reassign
    scene.heroSprite = heroSprite;
    scene.sprites.add(heroSprite);
};

export const calculateClosestStaticElement = (targetSprite, sprites) => {
    let closestSprite;
    let shortestDistance = Number.POSITIVE_INFINITY;

    sprites.forEach((sprite) => {
        const distance = PhaserMath.Distance.Between(targetSprite.x, targetSprite.y, sprite.body.x, sprite.body.y);
        if (distance < shortestDistance) {
            closestSprite = sprite;
            shortestDistance = distance;
        }
    });

    return closestSprite;
};

export const handleObjectsLayer = (scene) => {
    // Load game objects like items, enemies, etc
    scene.map.objects.forEach((objectLayerData, layerIndex) => {
        objectLayerData?.objects?.forEach((object, objectIndex) => {
            const { gid, properties, x, y, name, width, height } = object;
            const propertiesObject = Object.fromEntries(properties?.map((curr) => [curr.name, curr.value]) || []);

            switch (gid || name) {
                case SLIME_TILE_INDEX: {
                    const { type, health } = propertiesObject;
                    handleCreateEnemy(
                        scene,
                        `${ENEMY_SPRITE_PREFIX}_${SLIME_SPRITE_NAME}_${objectIndex}`,
                        { x, y },
                        type,
                        SLIME_SPRITE_NAME,
                        health
                    );

                    break;
                }

                case DOOR_TILE_INDEX: {
                    const { type, map: mapKey, position } = propertiesObject;
                    const [posX, posY] = position.split(';');

                    createTeleportTileObject(
                        scene,
                        { x, y },
                        mapKey,
                        { x: Number.parseInt(posX, 10), y: Number.parseInt(posY, 10) },
                        type
                    );

                    break;
                }

                default: {
                    break;
                }
            }
        });
    });
};

export const handleConfigureCamera = (scene) => {
    const { game } = scene.sys;
    const camera = scene.cameras.main;
    // console.log(JSON.stringify(game.scale.gameSize));

    // Configure the main camera
    camera.startFollow(scene.heroSprite, true);
    camera.setFollowOffset(-scene.heroSprite.width, -scene.heroSprite.height);
    camera.setBounds(
        0,
        0,
        Math.max(scene.map.widthInPixels, game.scale.gameSize.width),
        Math.max(scene.map.heightInPixels, game.scale.gameSize.height)
    );

    if (scene.map.widthInPixels < game.scale.gameSize.width) {
        camera.setPosition(Math.round((game.scale.gameSize.width - scene.map.widthInPixels) / 2));
    }

    if (scene.map.heightInPixels < game.scale.gameSize.height) {
        camera.setPosition(camera.x, Math.round((game.scale.gameSize.height - scene.map.heightInPixels) / 2));
    }
};

export const handleCreateItemAnimations = (scene, itemSprite, assetKey) => {
    createAnimation(
        itemSprite.anims,
        assetKey,
        'idle',
        3,
        3,
        -1,
        true
    );
};

export const handleCreateEnemyAnimations = (scene, enemySprite) => {
    // TODO check if animation already exists first
    [UP_DIRECTION, DOWN_DIRECTION, LEFT_DIRECTION, RIGHT_DIRECTION].forEach((direction) => {
        createAnimation(
            enemySprite.anims,
            enemySprite.enemyFamily,
            `walk_${direction}`,
            3,
            3,
            -1,
            true
        );
    });

    enemySprite.anims.play(`${enemySprite.enemyFamily}_walk_${DOWN_DIRECTION}`);
};

export const handleCreateHeroAnimations = (heroSprite) => {
    // Animations
    [UP_DIRECTION, DOWN_DIRECTION, LEFT_DIRECTION, RIGHT_DIRECTION].forEach((direction) => {
        createAnimation(
            heroSprite.anims,
            HERO_SPRITE_NAME,
            `walk_${direction}`,
            3,
            6,
            -1,
            true
        );
    });

    [UP_DIRECTION, DOWN_DIRECTION, LEFT_DIRECTION, RIGHT_DIRECTION].forEach((direction) => {
        createAnimation(
            heroSprite.anims,
            HERO_SPRITE_NAME,
            `attack_${direction}`,
            1,
            4,
            0,
            false
        );
    });

    // [UP_DIRECTION, DOWN_DIRECTION, LEFT_DIRECTION, RIGHT_DIRECTION].forEach((direction) => {
    //     createAnimation(
    //         sprite.anims,
    //         SWORD_SPRITE_NAME,
    //         `attack_${direction}`,
    //         1,
    //         4,
    //         0,
    //         false
    //     );
    // });
};

export const handleHeroMovement = (scene, heroSpeed = 80) => {
    const dialogMessages = getSelectorData(selectDialogMessages);
    if (dialogMessages.length > 0) {
        return;
    }

    // if (dialogMessages.length > 0 || scene.heroSprite.isTakingDamage) {
    //     scene.heroSprite.actionCollider.body.setVelocity(0, 0); // TODO maybe
    //     scene.heroSprite.updateActionCollider();
    //     return;
    // }

    const { setHeroFacingDirection } = getSelectorData(selectHeroSetters);

    let velocityX = 0;
    let velocityY = 0;
    let animName = null;

    if (scene.cursors.up.isDown || scene.wasd[UP_DIRECTION].isDown) {
        velocityY = -heroSpeed;
        animName = `${HERO_SPRITE_NAME}_walk_${UP_DIRECTION}`;
        setHeroFacingDirection(UP_DIRECTION);
    } else if (scene.cursors.down.isDown || scene.wasd[DOWN_DIRECTION].isDown) {
        velocityY = heroSpeed;
        animName = `${HERO_SPRITE_NAME}_walk_${DOWN_DIRECTION}`;
        setHeroFacingDirection(DOWN_DIRECTION);
    }

    if (scene.cursors.left.isDown || scene.wasd[LEFT_DIRECTION].isDown) {
        velocityX = -heroSpeed;
        animName = `${HERO_SPRITE_NAME}_walk_${LEFT_DIRECTION}`;
        setHeroFacingDirection(LEFT_DIRECTION);
    } else if (scene.cursors.right.isDown || scene.wasd[RIGHT_DIRECTION].isDown) {
        velocityX = heroSpeed;
        animName = `${HERO_SPRITE_NAME}_walk_${RIGHT_DIRECTION}`;
        setHeroFacingDirection(RIGHT_DIRECTION);
    }

    // Adjust velocity for diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
        velocityX *= 1 / Math.sqrt(2);
        velocityY *= 1 / Math.sqrt(2);
    }

    if (scene.heroSprite.anims.isPlaying && !scene.heroSprite.anims.currentAnim?.key.includes('walk')) {
        scene.heroSprite.body.setVelocity(0, 0); // TODO maybe
        return;
    }

    scene.heroSprite.body.setVelocity(velocityX, velocityY);
    scene.heroSprite.actionCollider.body.setVelocity(velocityX, velocityY);

    if (!scene.heroSprite.body.blocked.none || scene.heroSprite.body.speed === 0) {
        scene.heroSprite.actionCollider.body.setVelocity(0, 0); // TODO maybe
        scene.heroSprite.updateActionCollider();
    }

    if ((scene.heroSprite.body.blocked.up || scene.heroSprite.body.blocked.down) && velocityX !== 0) {
        scene.heroSprite.actionCollider.body.setVelocity(velocityX, 0); // TODO maybe
        scene.heroSprite.updateActionCollider();
    }

    if ((scene.heroSprite.body.blocked.left || scene.heroSprite.body.blocked.right) && velocityY !== 0) {
        scene.heroSprite.actionCollider.body.setVelocity(0, velocityY); // TODO maybe
        scene.heroSprite.updateActionCollider();
    }

    if (animName) {
        scene.heroSprite.anims.play(animName, true);
    } else {
        if (scene.heroSprite.anims.isPlaying) {
            scene.heroSprite.anims.stop();
        }

        const facingDirection = getSelectorData(selectHeroFacingDirection);
        scene.heroSprite.setFrame(IDLE_FRAME.replace(IDLE_FRAME_POSITION_KEY, facingDirection));
    }
};

export const changeScene = (scene, nextScene, assets = {}, config = {}) => {
    // const sceneKey = scene.scene.key;
    // scene.scene.stop(sceneKey);
    const startNewScene = () => {
        // const loadAssetsScene = scene.game.scene.getScene('LoadAssetsScene');
        scene.scene.start('LoadAssetsScene', {
            nextScene,
            assets,
        });
    };

    const { fadeType } = config;
    if (fadeType) {
        fade(scene, startNewScene, 'right', fadeType);
        return;
    }

    startNewScene();
};

export const fadeOut = (scene, callback = null, direction = 'right') => {
    fade(scene, callback, direction, 'out');
};

export const fadeIn = (scene, callback = null, direction = 'left') => {
    fade(scene, callback, direction, 'in');
};

// TODO make this into a new scene
const fade = (scene, callback, direction, type) => {
    const camera = scene.cameras.main;
    const gameWidth = getSelectorData(selectGameWidth);
    const gameHeight = getSelectorData(selectGameHeight);

    const blackBlock = scene.add.graphics();
    const multiplier = direction === 'right' ? 1 : -1;
    blackBlock.fillStyle(0x000000);
    const marginWidth = gameWidth * 0.1;
    const marginHeight = gameHeight * 0.1;

    blackBlock.fillRect(0, 0, gameWidth + marginWidth, gameHeight + marginHeight);
    let targetX = 0;
    blackBlock.setDepth(Number.POSITIVE_INFINITY);
    // blackBlock.setAlpha(0);

    if (type === 'in') {
        const addOnX = camera.scrollX > 0 ? scene.heroSprite.height : 0;
        const addOnY = camera.scrollY > 0 ? scene.heroSprite.width : 0;
        targetX = (camera.scrollX + addOnX) - (gameWidth + marginWidth * 2);
        blackBlock.setPosition(
            camera.scrollX + addOnX,
            camera.scrollY + addOnY
        );
    } else {
        targetX = camera.scrollX;
        blackBlock.setPosition(
            camera.scrollX - gameWidth,
            camera.scrollY
        );
    }

    blackBlock.setPosition(
        blackBlock.x - marginWidth / 2,
        blackBlock.y - marginHeight / 2
    );

    const duration = type === 'in' ? 700 : 1200;
    scene.time.delayedCall(duration * 0.7, () => {
        callback?.();
    });

    scene.tweens.add({
        targets: blackBlock,
        x: targetX,
        // alpha: 1,
        duration,
        ease: 'Power2',
        onComplete: () => {
            // callback?.();
            scene.time.delayedCall(10, () => {
                blackBlock.clear();
                blackBlock.destroy();
            });
        },
    });
};
