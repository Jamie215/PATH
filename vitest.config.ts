/**
 * Vitest runs on Astro's own Vite config (plugins, aliases, Svelte), so unit
 * tests compile code the same way the site build does.
 */
import { getViteConfig } from 'astro/config';

export default getViteConfig({});
