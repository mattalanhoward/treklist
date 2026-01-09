// src/config/defaultBackgrounds.js
import passoGiau from "../assets/images/dolomites-alta-via-1-passo-giau.jpeg";
import dolomiteHuts from "../assets/images/alta-via-2-odle-huts-alpine-landscape-bg.jpg";
import sasdelechMountainClouds from "../assets/images/alta-via-2-sass-da-lech-mountain-peak-clouds-bg.jpg";
import dolimiteGrassRidge from "../assets/images/dolomites-alta-via-2-mountain-trail-peak-bg.jpeg";

export const defaultBackgrounds = [
  { key: "passo-giau", label: "Passo Giau", url: passoGiau, publicId: null },
  {
    key: "dolomite-huts",
    label: "Dolomite Huts",
    url: dolomiteHuts,
    publicId: null,
  },
  {
    key: "sass-de-lech-clouds",
    label: "Sass de Lech Mountain Clouds",
    url: sasdelechMountainClouds,
    publicId: null,
  },
  {
    key: "dolomites-grass-ridge",
    label: "Dolomites Grass Ridge",
    url: dolimiteGrassRidge,
    publicId: null,
  },
];
