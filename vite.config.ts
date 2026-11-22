import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// Unique per build. The bundle embeds it as __BUILD_ID__ and the build also
// writes it to version.json; a running display polls that file and reloads
// when the deployed id no longer matches its own (see useAutoReload.ts).
const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: buildId }) + '\n',
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    watch: {
      usePolling: true,
    }
  },
})
