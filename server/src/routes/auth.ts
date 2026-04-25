function parseCardSwipe(raw: string) {
  const track1 = raw.match(/%B(\d+)\^([^^]+)\^/)
  if (!track1) return null

  const card_id = track1[1]
  const [lastName, firstName] = track1[2].split('/')

  return {
    card_id,
    name: `${firstName} ${lastName}`
  }
}