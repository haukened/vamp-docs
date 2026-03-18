// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'VAMP',
			logo: {
				light: './src/assets/logo-full-light.svg',
				dark: './src/assets/logo-full-dark.svg',
				replacesTitle: true,
			},
			customCss: ['./src/styles/site.css'],
			components: {
				Footer: './src/components/Footer.astro',
			},
			sidebar: [
				{
					label: 'Technical Narrative',
					autogenerate: { directory: 'technical' },
					collapsed: false,
				},
				{
					label: 'Research',
					autogenerate: { directory: 'research' },
				},
			],
		}),
	],
});
