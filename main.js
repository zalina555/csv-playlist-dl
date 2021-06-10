const fs = require('fs')
const papaparse = require('papaparse')
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const path = require('path')

let csv_file_path = `./ost-highlights.csv`
let csv_columns = {
    url:"Link",
    album:"Game",
    track_title:"Title",
    dont_download_flag:"Downloaded"
}

let max_concurrent_downloads = 10

let current_downloads = 0
let downloads_started = 0
let downloads_finished = 0
let total_tracks = 0

async function main(){
    let csv_file_stream = fs.readFileSync(csv_file_path, 'utf8');
    let csv = await papaparse.parse(csv_file_stream,{header:true})
    console.log(JSON.stringify(csv))
    total_tracks = csv.data.length
    for(let row of csv.data){
        while(current_downloads >= max_concurrent_downloads){
            await sleep(1000)
        }
        console.log(`downloads processing ${current_downloads}/${max_concurrent_downloads}`)
        download_track(row)
    }
}

function sleep(sleep_ms){
    return new Promise((resolve)=>{
        setTimeout(resolve,sleep_ms)
    })
}

function construct_track_name(track_info){
    return `${track_info[csv_columns.album]} ${track_info[csv_columns.track_title]}`
}

function make_file_name(track_info){
    let track_name = construct_track_name(track_info)
    return `${track_name.replace(/[/\\?%*:|"<>]/g, '-')}.mp3`;
}

async function check_url_validity(url){
    valid_url = false
    try{
        let info = await ytdl.getInfo(url)
        if(info){
            console.log('url is valid',url)
            valid_url = true
        }
    }catch(e){
        console.log('unable to get track info',`${url}`)
    }
    return valid_url
}

async function identify_download_link(track_info){
    let link = null
    if(track_info[csv_columns.url] != ""){
        let valid = await check_url_validity(track_info[csv_columns.url])
        if(valid){
            link = track_info[csv_columns.url]
        }
    }
    if(!link && track_info[csv_columns.album] != "" && track_info[csv_columns.track_title] != ""){
        let search_results = await ytsr(construct_track_name(track_info),{limit:1})
        console.log(search_results)
        if(search_results.items.length > 0){
            let valid = await check_url_validity(search_results.items[0].url)
            if(valid){
                link = search_results.items[0].url
            }
        }
    }
    return link
}

async function download_track(track_info){
    let output_file_name = make_file_name(track_info)
    if(track_info[csv_columns.dont_download_flag] != ""){
        console.log(`skipped ${output_file_name}`)
        return
    }
    current_downloads++
    try{
        let download_link = await identify_download_link(track_info)
        if(download_link){
            let output_path = path.join('.','output',output_file_name)
            downloads_started++
            console.log(`started downloading ${output_file_name} (${downloads_started}/${total_tracks})`)
            let stream = ytdl(download_link,{options:'highestaudio'}).pipe(fs.createWriteStream(output_path));
            await new Promise(resolve => stream.on("close", resolve));
            downloads_finished++
            console.log(`finished downloading ${output_file_name} (${downloads_finished}/${total_tracks})`)
        }
    }catch(e){
        console.log('unable to download track',e)
    }
    current_downloads--
}
main()