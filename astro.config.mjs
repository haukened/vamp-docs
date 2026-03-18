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
			head: [
				{
					tag: 'script',
					attrs: {
						src: 'https://cloud.umami.is/script.js',
						'data-website-id': '48932b5d-0254-4e2b-b876-a92c95c1e774',
						defer: true,
					}
				},
			],
			sidebar: [
				{
					label: 'Research',
					autogenerate: { directory: 'research' },
				},
			],
		}),
	],
});
