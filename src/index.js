/* eslint-disable react/jsx-filename-extension */
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Helmet } from 'react-helmet';
import { Fragment } from 'react';

// Styles
import './index.css';

// Components
import Game from './Game';

// Constants
import { REACT_CONTENT_ID } from './constants';

// Utils
import { instantiatePhaserGame } from './utils/phaser';

const theme = createTheme();
const root = ReactDOM.createRoot(document.getElementById(REACT_CONTENT_ID));

// Instantiate Phaser Game
instantiatePhaserGame();

root.render(
    <Fragment>
        <Helmet>
            <title>My Phaser Game</title>
        </Helmet>
        <ThemeProvider theme={theme}>
            <Game />
        </ThemeProvider>
    </Fragment>
);

