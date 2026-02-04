// src/config/defaultBackgrounds.js
// Using local assets while Cloudinary is unreliable

import passoGiau from "../assets/images/default-backgrounds/dolomites-alta-via-1-passo-giau.jpg";
import mountainTrailPeak from "../assets/images/default-backgrounds/dolomites-alta-via-2-mountain-trail-peak-bg.jpeg";
import sassDaLech from "../assets/images/default-backgrounds/alta-via-2-sass-da-lech-mountain-peak-clouds-bg.jpg";
import forcellaGiau from "../assets/images/default-backgrounds/dolomites-alta-via-1-forcella-giau.jpg";
import tourDuMontBlanc from "../assets/images/default-backgrounds/bg-tour-du-mont-blanc.jpg";
import caminoDeSantiago from "../assets/images/default-backgrounds/gear-list-camino-de-santiago.jpg";
import odleHuts from "../assets/images/default-backgrounds/alta-via-2-odle-huts-alpine-landscape-bg.jpg";
import tofanaRozes from "../assets/images/default-backgrounds/dolomites-alta-via-1-tofana-rozes.jpg";

export const defaultBackgrounds = [
  {
    key: "alta-via-1-passo-giau",
    label: "Alta Via 1 Passo Giau",
    url: passoGiau,
  },
  {
    key: "alta-via-2-grassy-ridge",
    label: "Alta Via 2 Grassy Ridge",
    url: mountainTrailPeak,
  },
  {
    key: "sass-da-lech",
    label: "Sass da Lech",
    url: sassDaLech,
  },
  {
    key: "alta-via-1-forcella-giau",
    label: "Alta Via 1 Forcella Giau",
    url: forcellaGiau,
  },
  {
    key: "tour-du-mont-blanc",
    label: "Tour du Mont Blanc",
    url: tourDuMontBlanc,
  },
  {
    key: "camino-de-santiago",
    label: "Camino de Santiago",
    url: caminoDeSantiago,
  },
  {
    key: "alta-via-2-odle-huts",
    label: "Alta Via 2 Odle Huts",
    url: odleHuts,
  },
  {
    key: "alta-via-1-tofana-rozes",
    label: "Alta Via 1 Tofana Rozes",
    url: tofanaRozes,
  },
];
