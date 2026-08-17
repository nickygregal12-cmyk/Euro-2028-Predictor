import { mkdirSync } from 'node:fs'
import { visualizer } from 'rollup-plugin-visualizer'
import {
  defineConfig,
  mergeConfig,
  type ConfigEnv,
  type UserConfig,
} from 'vite'
import baseConfig from './vite.config.ts'

async function resolveBaseConfig(env: ConfigEnv): Promise<UserConfig> {
  if (typeof baseConfig === 'function') {
    return await baseConfig(env)
  }
  return await baseConfig
}

export default defineConfig(async (env) => {
  mkdirSync('.artifacts', { recursive: true })

  return mergeConfig(await resolveBaseConfig(env), {
    plugins: [
      visualizer({
        filename: '.artifacts/bundle-stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    ],
  })
})
