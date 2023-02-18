const path = require('path');
const sharp = require('sharp');

async function generateSeparatedSpriteFiles(inputFilePath, spriteWidth, spriteHeight) {
    const outputDirectory = path.dirname(inputFilePath);

    const metadata = await sharp(inputFilePath).metadata();
    const cols = Math.floor(metadata.width / spriteWidth);
    const rows = Math.floor(metadata.height / spriteHeight);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const left = col * spriteWidth;
            const top = row * spriteHeight;
            const outputPath = path.join(outputDirectory, `${row}_${col}.png`);

            // eslint-disable-next-line no-await-in-loop
            await sharp(inputFilePath)
                .extract({ left, top, width: spriteWidth, height: spriteHeight })
                .toFile(outputPath);

            console.log(`Created ${outputPath}`);
        }
    }
}

generateSeparatedSpriteFiles(process.argv[2], 16, 20);
