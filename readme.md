# CSV playlist downloader
Given a CSV this script will download all the music from youtube

If you provide a url it will try to use that, otherwise it will do a youtube search using the album and track title - downloading the first result.

only downloads audio by default

### example csv

| Game        | Title           | Link                     | Downloaded |
| ----------- | --------------- | ------------------------ | ----------:|
| Minecraft   | Living Mice     | https://youtu.be/oGxQ... | True       |
| Minecraft   | Mall            | https://youtu.be/xmBf... |            |

### example usage with this csv

edit main.js because I'm too lazy to make this a library

```js
let csv_file_path = `./ost-highlights.csv`
let csv_columns = {
    url:"Link",
    album:"Game",
    track_title:"Title",
    dont_download_flag:"Downloaded"
}
```

`npm install`
`node main.js`