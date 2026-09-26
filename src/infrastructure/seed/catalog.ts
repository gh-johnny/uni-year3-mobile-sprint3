import { ServiceTypeKey } from '@/domain/service/service-type';
import { VehicleModelKey } from '@/domain/vehicle/vehicle-model';

export type DealerSeed = {
  id: string;
  name: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  phone: string;
  rating: number;
  bays: number;
  /** Hidden "operational quality" that drives retention in the synthetic data (never persisted). */
  quality: number;
  /** Average distance (km) customers live from this dealer. */
  catchmentKm: number;
  services: readonly ServiceTypeKey[];
};

const ALL: readonly ServiceTypeKey[] = ['revision', 'oil', 'brakes', 'tires', 'diagnostics', 'recall'];
const NO_TIRES: readonly ServiceTypeKey[] = ['revision', 'oil', 'brakes', 'diagnostics', 'recall'];

/** Fictional Ford dealers across Greater São Paulo (names are illustrative). */
export const DEALERS: readonly DealerSeed[] = [
  { id: 'dlr-pinheiros', name: 'Ford Pinheiros', city: 'São Paulo', district: 'Pinheiros', lat: -23.5667, lng: -46.6917, phone: '+55 11 3031-4400', rating: 4.8, bays: 4, quality: 1.0, catchmentKm: 6, services: ALL },
  { id: 'dlr-paulista', name: 'Ford Paulista', city: 'São Paulo', district: 'Bela Vista', lat: -23.5614, lng: -46.6559, phone: '+55 11 3251-2200', rating: 4.6, bays: 3, quality: 0.97, catchmentKm: 6, services: NO_TIRES },
  { id: 'dlr-moema', name: 'Ford Moema', city: 'São Paulo', district: 'Moema', lat: -23.601, lng: -46.666, phone: '+55 11 5051-7700', rating: 4.9, bays: 4, quality: 1.08, catchmentKm: 5, services: ALL },
  { id: 'dlr-santana', name: 'Ford Santana', city: 'São Paulo', district: 'Santana', lat: -23.502, lng: -46.625, phone: '+55 11 2959-1100', rating: 4.4, bays: 3, quality: 0.95, catchmentKm: 8, services: ALL },
  { id: 'dlr-tatuape', name: 'Ford Tatuapé', city: 'São Paulo', district: 'Tatuapé', lat: -23.5405, lng: -46.576, phone: '+55 11 2091-3300', rating: 4.5, bays: 3, quality: 1.0, catchmentKm: 7, services: ALL },
  { id: 'dlr-morumbi', name: 'Ford Morumbi', city: 'São Paulo', district: 'Morumbi', lat: -23.6, lng: -46.72, phone: '+55 11 3742-8800', rating: 4.7, bays: 3, quality: 1.05, catchmentKm: 7, services: ALL },
  { id: 'dlr-lapa', name: 'Ford Lapa', city: 'São Paulo', district: 'Lapa', lat: -23.527, lng: -46.704, phone: '+55 11 3611-5500', rating: 4.3, bays: 2, quality: 0.93, catchmentKm: 7, services: NO_TIRES },
  { id: 'dlr-ipiranga', name: 'Ford Ipiranga', city: 'São Paulo', district: 'Ipiranga', lat: -23.589, lng: -46.607, phone: '+55 11 2063-6600', rating: 4.5, bays: 3, quality: 0.98, catchmentKm: 7, services: ALL },
  { id: 'dlr-abc', name: 'Ford ABC', city: 'Santo André', district: 'Centro', lat: -23.6639, lng: -46.5383, phone: '+55 11 4990-2000', rating: 4.2, bays: 4, quality: 0.86, catchmentKm: 12, services: ALL },
  { id: 'dlr-guarulhos', name: 'Ford Guarulhos', city: 'Guarulhos', district: 'Macedo', lat: -23.4538, lng: -46.5333, phone: '+55 11 2440-9900', rating: 3.9, bays: 3, quality: 0.62, catchmentKm: 14, services: NO_TIRES },
  { id: 'dlr-osasco', name: 'Ford Osasco', city: 'Osasco', district: 'Centro', lat: -23.5329, lng: -46.7917, phone: '+55 11 3683-4100', rating: 4.4, bays: 3, quality: 0.96, catchmentKm: 10, services: ALL },
  { id: 'dlr-alphaville', name: 'Ford Alphaville', city: 'Barueri', district: 'Alphaville', lat: -23.502, lng: -46.849, phone: '+55 11 4191-3000', rating: 4.8, bays: 3, quality: 1.08, catchmentKm: 13, services: ALL },
];

export type ModelSeed = {
  key: VehicleModelKey;
  weight: number;
  wmi: string;
  versions: readonly string[];
  colors: readonly string[];
  kmPerMonth: number;
};

export const MODELS: readonly ModelSeed[] = [
  { key: 'ranger', weight: 28, wmi: '8AF', versions: ['XL 2.0', 'XLS 2.0', 'XLT 3.0 V6', 'Limited 3.0 V6'], colors: ['Branco Ártico', 'Prata Geada', 'Azul Belize', 'Preto Astúrias'], kmPerMonth: 1500 },
  { key: 'ranger-raptor', weight: 5, wmi: 'MNB', versions: ['Raptor 3.0 V6 Biturbo'], colors: ['Laranja Code Orange', 'Azul Performance', 'Preto Astúrias'], kmPerMonth: 1100 },
  { key: 'territory', weight: 20, wmi: 'LVS', versions: ['SEL 1.5 EcoBoost', 'Titanium 1.5 EcoBoost'], colors: ['Cinza Moscou', 'Branco Ártico', 'Azul Atlas'], kmPerMonth: 1050 },
  { key: 'maverick', weight: 12, wmi: '3FT', versions: ['Lariat Hybrid', 'Lariat FX4 2.0'], colors: ['Verde Área 51', 'Prata Geada', 'Cinza Carbono'], kmPerMonth: 1100 },
  { key: 'bronco-sport', weight: 10, wmi: '3FM', versions: ['Wildtrak 2.0'], colors: ['Azul Velocidade', 'Branco Oxford', 'Cinza Cactus'], kmPerMonth: 1000 },
  { key: 'mustang', weight: 5, wmi: '1FA', versions: ['GT Performance 5.0 V8', 'Mach 1 5.0 V8'], colors: ['Vermelho Race', 'Preto Shadow', 'Azul Atlas'], kmPerMonth: 450 },
  { key: 'mustang-mach-e', weight: 6, wmi: '3FM', versions: ['GT Performance AWD'], colors: ['Cinza Star', 'Azul Grabber'], kmPerMonth: 1200 },
  { key: 'transit', weight: 14, wmi: 'NM0', versions: ['Furgão 2.2', 'Minibus 2.2', 'Chassi 2.2'], colors: ['Branco Ártico'], kmPerMonth: 2600 },
];

export const FIRST_NAMES = [
  'Ana', 'Bruno', 'Camila', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João',
  'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Olívia', 'Pedro', 'Rafaela', 'Samuel', 'Tatiana', 'Vinícius',
  'Beatriz', 'Caio', 'Débora', 'Gustavo', 'Helena', 'Igor', 'Juliana', 'Leonardo', 'Marina', 'Otávio',
] as const;

export const LAST_NAMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Fernandes', 'Gomes', 'Honorato', 'Ishikawa', 'Jardim',
  'Lima', 'Moreira', 'Nascimento', 'Oliveira', 'Pereira', 'Queiroz', 'Rocha', 'Santos', 'Teixeira', 'Uchoa',
  'Vieira', 'Xavier', 'Yamamoto', 'Zanetti', 'Carvalho', 'Machado', 'Nogueira', 'Ribeiro', 'Siqueira', 'Tavares',
] as const;
