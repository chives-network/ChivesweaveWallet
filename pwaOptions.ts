import { VitePWAOptions } from 'vite-plugin-pwa'

export default (env: any): Partial<VitePWAOptions> => ({
	manifest: {
		name: env.VITE_TITLE,
		short_name: env.VITE_TITLE,
		description: env.VITE_DESCRIPTION,
		theme_color: env.VITE_BACKGROUND,
		background_color: env.VITE_BACKGROUND,
		display: 'standalone',
		scope: '/',
		start_url: '/',
		icons: [
			{
				src: 'chivesweave.svg',
				type: 'image/svg+xml',
				sizes: 'any',
				purpose: 'monochrome any',
			},
			{
				src: 'chivesweave-192.png',
				type: 'image/png',
				sizes: '192x192',
				purpose: 'monochrome any',
			},
			{
				src: 'chivesweave-512.png',
				type: 'image/png',
				sizes: '512x512',
				purpose: 'monochrome any',
			}
		],
		related_applications: [{
			platform: 'webapp',
			url: 'https://wallet.chivesweave.org/manifest.webmanifest'
		}]
	}
})