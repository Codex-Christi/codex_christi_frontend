import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';

const config = {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		keyframes: {
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			},
    			'ltr-linear-infinite': {
    				from: {
    					'background-position': '0 0'
    				},
    				to: {
    					'background-position': '-400vw 1000vw'
    				}
    			},
    			'caret-blink': {
    				'0%,70%,100%': {
    					opacity: '1'
    				},
    				'20%,50%': {
    					opacity: '0'
    				}
    			},
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			}
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			'ltr-linear-infinite': 'ltr-linear-infinite forwards 500s infinite',
    			'caret-blink': 'caret-blink 1.25s ease-out infinite',
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out'
    		},
    		fontFamily: {
    			nico: [
    				'var(--font-nico)',
                    ...fontFamily.sans
                ],
    			ocr: [
    				'var(--font-ocr)',
    				'sans-serif'
    			],
    			inter: [
    				'var(--font-inter)',
    				'helvetica',
    				'arial'
    			],
    			trade: [
    				'var(--font-trade-winds)',
    				'helvetica',
    				'arial'
    			]
    		},
    		textShadow: {
    			sm: '0 .07rem .125rem var(--tw-shadow-color)',
    			DEFAULT: '0 .125rem .25rem var(--tw-shadow-color)',
    			lg: '0 .25rem 1rem var(--tw-shadow-color)'
    		}
    	}
    },
	plugins: [
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		require("tailwindcss-animate"),
		plugin(function ({ matchUtilities, theme }) {
			matchUtilities(
				{
					"text-shadow": (value: string) => ({
						textShadow: value,
					}),
				},
				{ values: theme("textShadow") },
			);
		}),
	],
} satisfies Config;

export default config;
