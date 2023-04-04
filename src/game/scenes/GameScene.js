import { Physics, Geom } from 'phaser';
import { GridEngine } from 'grid-engine';

// Utils
import {
    fadeIn,
    handleCreateMap,
    handleCreateHero,
    handleObjectsLayer,
    handleHeroMovement,
    handleCreateGroups,
    handleCreateControls,
    handleConfigureCamera,
    handleCreateHeroAnimations,
    subscribeToGridEngineEvents,
    calculateClosesestStaticElement,
} from '../../utils/sceneHelpers';
import { getSelectorData } from '../../utils/utils';

// Selectors
import {
    selectGameSetters,
    selectShouldPauseScene,
} from '../../zustand/game/selectGameData';
import { selectHeroFacingDirection } from '../../zustand/hero/selectHeroData';

// Constants
import {
    BOX_INDEX,
    TILE_WIDTH,
    GRASS_INDEX,
    TILE_HEIGHT,
    UP_DIRECTION,
    DOWN_DIRECTION,
    LEFT_DIRECTION,
    RIGHT_DIRECTION,
    HERO_SPRITE_NAME,
    SHOULD_TILE_COLLIDE,
} from '../../constants';

export const key = 'GameScene';

export const sceneHelpers = {};

export const preload = () => {
    const scene = sceneHelpers.getScene();
    scene.load.scenePlugin('gridEngine', GridEngine, 'gridEngine', 'gridEngine');
};

export function create() {
    const scene = sceneHelpers.getScene();
    // scene.gridEngine = scene.game.scene.scenes.find((s) => s.scene.key === key).gridEngine;
    // scene.plugins.installScenePlugin('gridEngine', GridEngine, 'gridEngine' );
    // scene.input.on('pointerup', (pointer) => {
    //     console.log('clicky click');
    // });
    const { addGameCameraSizeUpdateCallback, setGameShowHeadsUpDisplay } = getSelectorData(selectGameSetters);
    setGameShowHeadsUpDisplay(true);

    // All of these functions need to be called in order

    fadeIn(scene);

    // Create controls
    handleCreateControls(scene);

    // Create game groups
    handleCreateGroups(scene);

    // Create the map
    const customColliders = handleCreateMap(scene);

    // Create hero sprite
    handleCreateHero(scene);

    // Load game objects like items, enemies, etc
    handleObjectsLayer(scene);

    // Configure the main camera
    handleConfigureCamera(scene);
    addGameCameraSizeUpdateCallback(() => {
        handleConfigureCamera(scene);
    });

    // TODO Hero animations
    handleCreateHeroAnimations(scene.heroSprite);

    // Subscribe to grid-engine events
    subscribeToGridEngineEvents(scene);

    // Handle collisions
    scene.physics.add.collider(scene.heroSprite, scene.mapLayers);
    const heroEnemyOverlap = scene.physics.add.overlap(scene.heroSprite, scene.enemies, (heroSprite, enemySprite) => {
        // console.log('overlap', 'heroSprite, enemySprite', enemyHeroOverlap);
        heroSprite.handleTakeDamage(5, enemySprite, heroEnemyOverlap);
        // enemySprite.handleHeroOverlap?.(heroSprite);
    });

    // scene.physics.add.collider(scene.mapLayers, scene.elements);
    scene.physics.add.collider(scene.heroSprite, scene.elements);
    // scene.physics.add.collider(scene.elements, null);
    scene.physics.add.collider(scene.heroSprite, customColliders);

    const overlaps = new Set();
    scene.physics.add.overlap(scene.elements, scene.heroSprite.actionCollider, (element, actionCollider) => {
        overlaps.add(element);
    });

    scene.heroSprite.actionCollider.on('overlapend', () => {
        overlaps.clear();
        // console.log('overlapend', overlaps);
    });

    // scene.heroSprite.actionCollider.on('overlapstart', () => {
    //     console.log('overlapstart', overlaps);
    // });

    scene.physics.add.overlap(
        scene.heroSprite.attackSprite,
        scene.enemies,
        (attackSprite, enemySprite) => {
            enemySprite.onAttackOverlap(attackSprite, enemySprite);
        }
    );

    scene.physics.add.overlap(
        scene.heroSprite.presencePerceptionCircle,
        scene.enemies,
        (presencePerceptionCircle, enemySprite) => {
            enemySprite.onPresenceOverlap(presencePerceptionCircle, enemySprite);
        }
    );

    // TODO
    scene.input.keyboard.on('keydown-SPACE', () => {
        if (scene.heroSprite.isAttacking) {
            return;
        }

        const heroFacingDirection = getSelectorData(selectHeroFacingDirection);
        const element = calculateClosesestStaticElement(scene.heroSprite, overlaps);

        if (element) {
            if (element.elementType === BOX_INDEX) {
                if (element.isMoving) {
                    return;
                }

                let diffX = 0;
                let diffY = 0;

                switch (heroFacingDirection) {
                    case UP_DIRECTION:
                        diffY = -TILE_HEIGHT;
                        break;
                    case DOWN_DIRECTION:
                        diffY = TILE_HEIGHT;
                        break;
                    case LEFT_DIRECTION:
                        diffX = -TILE_WIDTH;
                        break;
                    case RIGHT_DIRECTION:
                        diffX = TILE_WIDTH;
                        break;
                    default:
                        // Handle invalid direction
                        break;
                }

                // the actual sprite position is not acurate
                // because of a lot of offsets
                // so to get the real position we need to check for the body
                // but to move the sprite image we need to move the sprite itself
                // this is like this because I'm using the tile image as the sprite image
                const startX = element.x;
                const startY = element.y;
                const newX = startX + diffX;
                const newY = startY + diffY;
                const bodyStartX = element.body.x;
                const bodyStartY = element.body.y;
                const bodyNewX = bodyStartX + diffX;
                const bodyNewY = bodyStartY + diffY;
                scene.heroSprite.anims.play(`${HERO_SPRITE_NAME}_attack_${heroFacingDirection}`, true);

                // scene.physics.moveTo(element, newX, newY);
                const isOccupiedByTile = scene.mapLayers.getChildren().some((layer) => {
                    const tile = scene.map.getTileAtWorldXY(bodyNewX, bodyNewY, false, undefined, layer);
                    return tile?.properties?.[SHOULD_TILE_COLLIDE] || false;
                });

                if (isOccupiedByTile) {
                    return;
                }

                const isOccupiedBySprite = scene.elements.getChildren().some((sprite) => {
                    if (sprite === element) {
                        return false; // skip checking against itself
                    }

                    const spriteBounds = new Geom.Rectangle(
                        sprite.body.x,
                        sprite.body.y,
                        sprite.body.width,
                        sprite.body.height
                    );

                    return Geom.Rectangle.Overlaps(
                        spriteBounds,
                        new Geom.Rectangle(bodyNewX, bodyNewY, element.body.width, element.body.height)
                    );
                });

                if (isOccupiedBySprite) {
                    return;
                }

                element.isMoving = true;
                scene.tweens.add({
                    targets: element,
                    x: newX,
                    y: newY,
                    duration: 500,
                    ease: 'Linear',
                    onUpdate: (tween, target) => {
                        const { totalProgress } = tween;
                        if (target.body && target.body.type === Physics.STATIC_BODY) {
                            // eslint-disable-next-line no-param-reassign
                            target.body.x = bodyStartX + (newX - startX) * totalProgress;
                            // eslint-disable-next-line no-param-reassign
                            target.body.y = bodyStartY + (newY - startY) * totalProgress;
                        }
                    },
                    onComplete: () => {
                        element.isMoving = false;
                    },
                });

                return;
            }

            // TODO move this to a overlap with the attack sprite
            if (element.elementType === GRASS_INDEX) {
                element.handleDestroyElement();
                overlaps.delete(element);
            }
        }

        scene.heroSprite.isAttacking = true;
        scene.heroSprite.attackSprite.setVisible(true);

        const updateAttackPosition = () => {
            const heroFacingDirection = getSelectorData(selectHeroFacingDirection);
            switch (heroFacingDirection) {
                case DOWN_DIRECTION: {
                    scene.heroSprite.attackSprite.setX(scene.heroSprite.x - scene.heroSprite.body.width + 2);
                    scene.heroSprite.attackSprite.setY(scene.heroSprite.y - 6);
                    scene.heroSprite.attackSprite.body.setOffset(17, 22);

                    break;
                }

                case UP_DIRECTION: {
                    scene.heroSprite.attackSprite.setX(scene.heroSprite.x - scene.heroSprite.body.width + 2);
                    scene.heroSprite.attackSprite.setY(scene.heroSprite.y - scene.heroSprite.body.height + 6);
                    scene.heroSprite.attackSprite.body.setOffset(9, 1);

                    break;
                }

                case LEFT_DIRECTION: {
                    scene.heroSprite.attackSprite.setX(scene.heroSprite.x - scene.heroSprite.body.width + 2);
                    scene.heroSprite.attackSprite.setY(scene.heroSprite.y - scene.heroSprite.body.height + 6);
                    scene.heroSprite.attackSprite.body.setOffset(0, 8);

                    break;
                }

                case RIGHT_DIRECTION: {
                    scene.heroSprite.attackSprite.setX(scene.heroSprite.x - scene.heroSprite.body.width + 2);
                    scene.heroSprite.attackSprite.setY(scene.heroSprite.y - 6);
                    scene.heroSprite.attackSprite.body.setOffset(24, 8);

                    break;
                }

                default: {
                    break;
                }
            }

            scene.heroSprite.attackSprite.setFrame(`attack_${heroFacingDirection}_01`);
        };

        updateAttackPosition();
        scene.heroSprite.attackSprite.update = updateAttackPosition;
        const handleAttackComplete = (animation, frame) => {
            if (!animation.key.includes('hero_attack')) {
                return;
            }

            while (scene.heroSprite.attackSprite.enemies.length > 0) {
                const enemySprite = scene.heroSprite.attackSprite.enemies.pop();
                enemySprite.handleStopTakingDamage();
            }

            scene.heroSprite.attackSprite.setVisible(false);
            scene.heroSprite.isAttacking = false;
            delete scene.heroSprite.attackSprite.update;
        };

        const handleAttackStarted = (animation, frame) => {
            if (!animation.key.includes('hero_attack')) {
                return;
            }

            scene.heroSprite.attackSprite.setVisible(true);
        };

        scene.heroSprite.anims.play(`${HERO_SPRITE_NAME}_attack_${heroFacingDirection}`, true)
            .once('animationstart', handleAttackStarted)
            .once('animationcomplete', handleAttackComplete)
            .once('animationstop', handleAttackComplete);
    });

    scene.heroSprite.on('animationstop', () => {
        scene.heroSprite.actionCollider.body.setVelocity(0, 0);
    });

    scene.heroSprite.on('animationstart', () => {
        const { heroSprite } = scene;
        heroSprite.updateActionCollider();
    });
}

export function update(time, delta) {
    const scene = sceneHelpers.getScene();
    const shouldPause = getSelectorData(selectShouldPauseScene(key));
    if (shouldPause) {
        // TODO figure out a better way to do this
        scene.heroSprite.body.setVelocity(0, 0);
        scene.heroSprite.anims.pause();
        return;
    }

    handleHeroMovement(scene);
    scene.heroSprite.update(time, delta);
    scene.heroSprite.actionCollider.update(time, delta);
    scene.enemies.getChildren().forEach((enemy) => {
        enemy?.update?.(time, delta);
    });
}
