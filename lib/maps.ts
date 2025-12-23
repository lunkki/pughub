export type MapInfo = {
  id: string;
  name: string;
  image: string;
  type: "stock" | "workshop";
  command: string;
  workshopId?: string;
};

// Base URL for images
const IMG = "/maps";



export const MAPS: MapInfo[] = [
  // -------- STOCK MAPS --------
  {
    id: "cs_italy",
    name: "Italy",
    image: `${IMG}/cs_italy.jpg`,
    type: "stock",
    command: "changelevel cs_italy",
  },
  {
    id: "cs_office",
    name: "Office",
    image: `${IMG}/cs_office.jpg`,
    type: "stock",
    command: "changelevel cs_office",
  },
  {
    id: "de_vertigo",
    name: "Vertigo",
    image: `${IMG}/de_vertigo.jpg`,
    type: "stock",
    command: "changelevel de_vertigo",
  },
  {
    id: "de_ancient",
    name: "Ancient",
    image: `${IMG}/de_ancient.jpg`,
    type: "stock",
    command: "changelevel de_ancient",
  },
  {
    id: "de_ancient_night",
    name: "Ancient Night",
    image: `${IMG}/de_ancient_night.jpg`,
    type: "stock",
    command: "changelevel de_ancient_night",
  },
  {
    id: "de_anubis",
    name: "Anubis",
    image: `${IMG}/de_anubis.jpg`,
    type: "stock",
    command: "changelevel de_anubis",
  },
  {
    id: "de_dust2",
    name: "Dust 2",
    image: `${IMG}/de_dust2.jpg`,
    type: "stock",
    command: "changelevel de_dust2",
  },
  {
    id: "de_inferno",
    name: "Inferno",
    image: `${IMG}/de_inferno.jpg`,
    type: "stock",
    command: "changelevel de_inferno",
  },
  {
    id: "de_mirage",
    name: "Mirage",
    image: `${IMG}/de_mirage.jpg`,
    type: "stock",
    command: "changelevel de_mirage",
  },
  {
    id: "de_nuke",
    name: "Nuke",
    image: `${IMG}/de_nuke.jpg`,
    type: "stock",
    command: "changelevel de_nuke",
  },
  {
    id: "de_overpass",
    name: "Overpass",
    image: `${IMG}/de_overpass.jpg`,
    type: "stock",
    command: "changelevel de_overpass",
  },
  {
    id: "de_train",
    name: "Train",
    image: `${IMG}/de_train.jpg`,
    type: "stock",
    command: "changelevel de_train",
  },
  {
    id: "de_jura",
    name: "Jura",
    image: `${IMG}/de_jura.jpg`,
    type: "stock",
    command: "changelevel de_jura",
  },
  {
    id: "de_grail",
    name: "Grail",
    image: `${IMG}/de_grail.jpg`,
    type: "stock",
    command: "changelevel de_grail",
  },
  {
    id: "cs_agency",
    name: "Agency",
    image: `${IMG}/cs_agency.jpg`,
    type: "stock",
    command: "changelevel cs_agency",
  },

  // -------- WORKSHOP MAPS --------
  {
    id: "de_basalt",
    name: "Basalt",
    image: `${IMG}/de_basalt.jpg`,
    type: "workshop",
    workshopId: "3329258290",
    command: "host_workshop_map 3329258290",
  },
  {
    id: "de_edin",
    name: "Edin",
    image: `${IMG}/de_edin.jpg`,
    type: "workshop",
    workshopId: "3328169568",
    command: "host_workshop_map 3328169568",
  },
  {
    id: "de_assembly",
    name: "Assembly",
    image: `${IMG}/de_assembly.jpg`,
    type: "workshop",
    workshopId: "3071005299",
    command: "host_workshop_map 3071005299",
  },
  {
    id: "de_cbble_d",
    name: "Cobblestone",
    image: `${IMG}/de_cbble_d.jpg`,
    type: "workshop",
    workshopId: "3329387648",
    command: "host_workshop_map 3329387648",
  },
  {
    id: "de_cache",
    name: "Cache",
    image: `${IMG}/de_cache.jpg`,
    type: "workshop",
    workshopId: "3437809122",
    command: "host_workshop_map 3437809122",
  },
  {
    id: "de_pipeline",
    name: "Pipeline",
    image: `${IMG}/de_pipeline.jpg`,
    type: "workshop",
    workshopId: "3079872050",
    command: "host_workshop_map 3079872050",
  },
  {
    id: "de_biome",
    name: "Biome",
    image: `${IMG}/de_biome.jpg`,
    type: "workshop",
    workshopId: "3075706807",
    command: "host_workshop_map 3075706807",
  },
  {
    id: "mp_raid",
    name: "Raid",
    image: `${IMG}/mp_raid.jpg`,
    type: "workshop",
    workshopId: "3070346180",
    command: "host_workshop_map 3070346180",
  },
  {
    id: "de_mutiny",
    name: "Mutiny",
    image: `${IMG}/de_mutiny.jpg`,
    type: "workshop",
    workshopId: "3070766070",
    command: "host_workshop_map 3070766070",
  },
  {
    id: "cs_assault",
    name: "Assault",
    image: `${IMG}/cs_assault.jpg`,
    type: "workshop",
    workshopId: "3070594412",
    command: "host_workshop_map 3070594412",
  },
  {
    id: "de_ruins_d_prefab",
    name: "Ruins (Prefab)",
    image: `${IMG}/de_ruins_d_prefab.jpg`,
    type: "workshop",
    workshopId: "3072352643",
    command: "host_workshop_map 3072352643",
  },
  {
    id: "cs_militia",
    name: "Militia",
    image: `${IMG}/cs_militia.jpg`,
    type: "workshop",
    workshopId: "3089953774",
    command: "host_workshop_map 3089953774",
  },
  {
    id: "de_aztec_hr",
    name: "Aztec HR",
    image: `${IMG}/de_aztec_hr.jpg`,
    type: "workshop",
    workshopId: "3079692971",
    command: "host_workshop_map 3079692971",
  },
  {
    id: "de_akiba",
    name: "Akiba",
    image: `${IMG}/de_akiba.jpg`,
    type: "workshop",
    workshopId: "3108513658",
    command: "host_workshop_map 3108513658",
  },
  {
    id: "cs_insertion2",
    name: "Insertion 2",
    image: `${IMG}/cs_insertion2.jpg`,
    type: "workshop",
    workshopId: "3236615060",
    command: "host_workshop_map 3236615060",
  },
  {
    id: "de_train_ws",
    name: "Train (WS)",
    image: `${IMG}/de_train.jpg`,
    type: "workshop",
    workshopId: "3070284539",
    command: "host_workshop_map 3070284539",
  },
  {
    id: "de_tuscan_d",
    name: "Tuscan",
    image: `${IMG}/de_tuscan_d.jpg`,
    type: "workshop",
    workshopId: "3267671493",
    command: "host_workshop_map 3267671493",
  },
  {
    id: "de_mills",
    name: "Mills",
    image: `${IMG}/de_mills.jpg`,
    type: "workshop",
    workshopId: "3152430710",
    command: "host_workshop_map 3152430710",
  },
  {
    id: "de_nuke_classic",
    name: "1.6 Nuke",
    image: `${IMG}/de_nuke_classic.jpg`,
    type: "workshop",
    workshopId: "3205793205",
    command: "host_workshop_map 3205793205",
  },
  {
    id: "de_piranesi",
    name: "Piranesi",
    image: `${IMG}/de_piranesi.jpg`,
    type: "workshop",
    workshopId: "3072451578",
    command: "host_workshop_map 3072451578",
  },
    {
    id: "de_prodigy_ported",
    name: "Prodigy",
    image: `${IMG}/de_prodigy_ported.jpg`,
    type: "workshop",
    workshopId: "3101490275",
    command: "host_workshop_map 3101490275",
  },

  {
    id: "de_thera",
    name: "Thera",
    image: `${IMG}/de_thera.jpg`,
    type: "workshop",
    workshopId: "3121217565",
    command: "host_workshop_map 3121217565",
  },
  {
    id: "de_season",
    name: "Season",
    image: `${IMG}/de_season.jpg`,
    type: "workshop",
    workshopId: "3073892687",
    command: "host_workshop_map 3073892687",
  },
  {
    id: "de_ema",
    name: "Ema",
    image: `${IMG}/de_ema.jpg`,
    type: "workshop",
    workshopId: "3386116667",
    command: "host_workshop_map 3386116667",
  },
  {
    id: "twofort_cs2",
    name: "Twofort",
    image: `${IMG}/twofort_cs2.jpg`,
    type: "workshop",
    workshopId: "3345551391",
    command: "host_workshop_map 3345551391",
  },
  {
    id: "de_rats_remake",
    name: "Rats Remake",
    image: `${IMG}/de_rats_remake.jpg`,
    type: "workshop",
    workshopId: "3460962520",
    command: "host_workshop_map 3460962520",
  },
  {
    id: "de_mirage_bricks",
    name: "Mirage Bricks",
    image: `${IMG}/de_mirage_bricks.jpg`,
    type: "workshop",
    workshopId: "3464733042",
    command: "host_workshop_map 3464733042",
  },
];


// ACTIVE DUTY LIST (full objects)
export const ACTIVE_DUTY = MAPS.filter((m) =>
  [
    "de_mirage",
    "de_inferno",
    "de_nuke",
    "de_overpass",
    "de_ancient",
    "de_dust2",
    "de_train",
  ].includes(m.id)
);

// ALL MAPS (full objects)
export const ALL_MAPS = MAPS;

export function getMapById(id: string): MapInfo | undefined {
  return MAPS.find((m) => m.id === id);
}

export function getMapCommand(id: string): string {
  return getMapById(id)?.command ?? `changelevel ${id}`;
}
