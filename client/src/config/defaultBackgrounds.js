// // src/config/defaultBackgrounds.js

const CLOUD = "treklist";
const cldUrl = (publicIdWithVersion) =>
  `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/${publicIdWithVersion}`;

export const defaultBackgrounds = [
  {
    key: "alta-via-1-passo-giau",
    label: "Alta Via 1 Passo Giau",
    publicId: "gear-list-backgrounds/bg-dolomites-alta-via-1-passo-giau",
    url: cldUrl(
      "v1768095770/gear-list-backgrounds/bg-dolomites-alta-via-1-passo-giau.jpg"
    ),
  },
  {
    key: "alta-via-2-grassy-ridge",
    label: "Alta Via 2 Grassy Ridge",
    publicId:
      "gear-list-backgrounds/bg-dolomites-alta-via-2-mountain-trail-peak",
    url: cldUrl(
      "v1768095485/gear-list-backgrounds/bg-dolomites-alta-via-2-mountain-trail-peak.jpg"
    ),
  },
  {
    key: "piz-pisciadu",
    label: "Piz Pisciadu",
    publicId: "gear-list-backgrounds/bg-av2-piz-pisciadu",
    url: cldUrl("v1752666491/gear-list-backgrounds/bg-av2-piz-pisciadu.jpg"),
  },
  {
    key: "alta-via-1-forcella-giau",
    label: "Alta Via 1 Forcella Giau",
    publicId: "gear-list-backgrounds/bg-dolomites-alta-via-1-forcella-giau",
    url: cldUrl(
      "v1768096123/gear-list-backgrounds/bg-dolomites-alta-via-1-forcella-giau.jpg"
    ),
  },
  {
    key: "tour-du-mont-blanc",
    label: "Tour du Mont Blanc",
    publicId: "gear-list-backgrounds/bg-tour-du-mont-blanc",
    url: cldUrl("v1768096299/gear-list-backgrounds/bg-tour-du-mont-blanc.jpg"),
  },
  {
    key: "camino-de-santiago",
    label: "Camino de Santiago",
    publicId: "gear-list-landing/gear-list-camino-de-santiago",
    url: cldUrl(
      "v1752415040/gear-list-landing/gear-list-camino-de-santiago.jpg"
    ),
  },
  {
    key: "alta-via-2-odle-huts",
    label: "Alta Via 2 Odle Huts",
    publicId: "gear-list-backgrounds/bg-alta-via-2-odle-huts-alpine-landscape",
    url: cldUrl(
      "v1768095481/gear-list-backgrounds/bg-alta-via-2-odle-huts-alpine-landscape.jpg"
    ),
  },
  {
    key: "alta-via-1-tofana-rozes",
    label: "Alta Via 1 Tofana Rozes",
    publicId: "gear-list-backgrounds/bg-dolomites-alta-via-1-tofana-rozes",
    url: cldUrl(
      "v1768097269/gear-list-backgrounds/bg-dolomites-alta-via-1-tofana-rozes.jpg"
    ),
  },
];
