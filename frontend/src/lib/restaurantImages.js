// The backend names images by key (the file name without its extension); the files ship with the app.
const logos = import.meta.glob('../assets/logos/*.svg', { eager: true, import: 'default' })
const photos = import.meta.glob('../assets/photos/*.jpg', { eager: true, import: 'default' })

function byKey(files) {
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), url]),
  )
}

const logoUrls = byKey(logos)
const photoUrls = byKey(photos)

export const logoUrl = (key) => logoUrls[key]
export const photoUrl = (key) => photoUrls[key]
