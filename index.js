const express = require('express');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs-extra');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const exec = require('child_process').exec;
const videoLib = require('node-video-lib');
const app = express();

// Serve static files (for accessing the images, PDFs, and videos)
app.use(express.static('public'));

// Route to overlay logo and text onto an image
app.get('/overlay-image', async (req, res) => {
    try {
        const baseImage = await Jimp.read(path.join(__dirname, 'public', 'uploads', 'base-image.jpeg'));
        const logo = await Jimp.read(path.join(__dirname, 'public', 'uploads', 'logo.png'));

        // Resize the base image (increase its size)
        baseImage.resize(500, 400);

        // Resize the logo
        logo.resize(50, 50);

        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        const text = 'Co-branded Image';

        const baseImageWidth = baseImage.getWidth();
        const baseImageHeight = baseImage.getHeight();
        const padding = 10;
        const xPos = baseImageWidth - 50 - padding;
        const yPos = baseImageHeight - 50 - padding;

        baseImage.composite(logo, xPos, yPos, {
            mode: Jimp.BLEND_SOURCE_OVER,
            opacitySource: 1,
            opacityDest: 1
        });

        baseImage.print(font, xPos - Jimp.measureText(font, text) - padding, yPos + 10, text);

        const baseImagePath = path.join(__dirname, 'public', 'uploads', 'base-image-modified.jpg');
        await baseImage.writeAsync(baseImagePath);

        res.sendFile(baseImagePath);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing image');
    }
});

// Route to create a PDF with text and logo
app.get('/overlay-pdf', async (req, res) => {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([500, 400]);

        const logoBytes = fs.readFileSync(path.join(__dirname, 'public', 'uploads', 'logo.png'));
        const logoPdf = await pdfDoc.embedPng(logoBytes);

        const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

        const text = 'Co-branded Image';
        const pageText = 'This is the PDF file';
        const fontSize = 16;

        page.drawText(pageText, {
            x: 50,
            y: page.getHeight() - 30,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0)
        });

        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const logoWidth = 50;
        const padding = 10;

        page.drawText(text, {
            x: page.getWidth() - logoWidth - textWidth - 2 * padding,
            y: padding,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0)
        });

        page.drawImage(logoPdf, {
            x: page.getWidth() - logoWidth - padding,
            y: padding,
            width: logoWidth,
            height: logoWidth
        });

        const pdfBytes = await pdfDoc.save();
        const outputPdfPath = path.join(__dirname, 'public', 'uploads', 'output-document.pdf');
        fs.writeFileSync(outputPdfPath, pdfBytes);

        res.sendFile(outputPdfPath);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing PDF');
    }
});

// Route to overlay logo and text onto a video
app.get('/overlay-video', async (req, res) => {
    console.log('Received request for /overlay-video'); // Add logging

    const inputVideoPath = path.join(__dirname, 'public', 'uploads', 'input-video.mp4');
    const outputVideoPath = path.join(__dirname, 'public', 'uploads', 'output-video.mp4');
    const logoPath = path.join(__dirname, 'public', 'uploads', 'logo.png');
    const text = 'Co-branded Video';

    console.log('Input video path:', inputVideoPath); // Debugging the path

    if (!fs.existsSync(inputVideoPath)) {
        console.log('Video file does not exist.');
        return res.status(400).send('Video file does not exist.');
    }

    try {
        const outputDir = path.dirname(outputVideoPath);
        await fs.ensureDir(outputDir);

        const ffmpegCommand = `ffmpeg -i "${inputVideoPath}" -i "${logoPath}" -filter_complex "[0:v][1:v] overlay=W-w-10:H-h-10, drawtext=text='${text}':x=10:y=10:fontsize=24:fontcolor=white" -codec:a copy "${outputVideoPath}"`;

        console.log('Running FFmpeg command:', ffmpegCommand); // Debugging the command

        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing FFmpeg: ${error.message}`);
                console.error(`FFmpeg stderr: ${stderr}`);
                return res.status(500).send('Error processing video');
            }
            console.log(`FFmpeg stdout: ${stdout}`);

            if (fs.existsSync(outputVideoPath)) {
                res.sendFile(outputVideoPath, (err) => {
                    if (err) {
                        console.error('Error sending file:', err);
                        res.status(500).send('Error sending video file');
                    }
                });
            } else {
                console.log('Output video file not created.');
                res.status(500).send('Output video file not created.');
            }
        });
    } catch (err) {
        console.error('Error processing video:', err);
        res.status(500).send('Error processing video');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
