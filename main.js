const fs = require('fs')
const fspromises = require('fs/promises')
const papaparse = require('papaparse')
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const path = require('path')
const ytpl = require('@distube/ytpl');
const ffmpeg = require('fluent-ffmpeg');

let csv_file_path = `./dddddddddddddd.csv`
let csv_file_path_out = `./dddddddddddddd.csv`
let output_folder = `./out2`
let csv_columns = {
    url:"Link",
    album:"Game",
    track_title:"Title",
    dont_download_flag:"Downloaded"
}
let csv = null

async function save_csv(data,path){
    let csv_data = papaparse.unparse(data)
    await fspromises.writeFile(path, csv_data,'utf-8')
}

function hmsToSecondsOnly(str) {
    var p = str.split(':'),
        s = 0, m = 1;

    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }
    return s;
}

let max_song_length = 999*60
let total_tracks = 0
let tracks_queried = 0

function parse_from_playlist(url){
    return new Promise((resolve,reject)=>{
        ytpl(url, 'url').then(res => {
            let rows = []
            for(let track_info of res.items){
                let info = {}
                info[csv_columns.dont_download_flag] = ""
                info[csv_columns.url] = track_info.url
                info[csv_columns.track_title] = track_info.title
                rows.push(info)
                console.log(info)
            }
            /* Object
            { data:
             { playlist:
                [ 'https://youtube.com/watch?v=bgU7FeiWKzc',
                  'https://youtube.com/watch?v=3PUVr8jFMGg',
                  'https://youtube.com/watch?v=3pXVHRT-amw',
                  'https://youtube.com/watch?v=KOVc5o5kURE' ] } }
             */
            resolve({data:rows})
        });
    })
}

async function main(){
    let playlist_url = `https://www.youtube.com/playlist?list=PL5sZjPFWu5Pa8LuWvahRjyWnNOZ65X6mA&jct=-R8A60R0l4zxhN-pnAQPEwPu19BxKg`
    let csv_file_stream = fs.readFileSync(csv_file_path, 'utf8');
    csv = await papaparse.parse(csv_file_stream,{header:true})
    //let csv = await parse_from_playlist(playlist_url)
    console.log('csv',csv)

    console.log(JSON.stringify(csv))
    total_tracks = csv.data.length
    for(let row of csv.data){
        tracks_queried++
        console.log(`requesting video info ${tracks_queried}/${total_tracks}`)
        await add_link_to_list(row)
    }
}

function sleep(sleep_ms){
    return new Promise((resolve)=>{
        setTimeout(resolve,sleep_ms)
    })
}

function make_download_name(track_info,track_ytdl_info){
    let track_name = `${track_info[csv_columns.album]} ${track_ytdl_info.videoDetails.title}`
    return `${track_name.replace(/[/\\?%*:|"<>]/g, '-')}.mp3`;
}

function construct_search_string(track_info){
    return `${track_info[csv_columns.album]} OST ${track_info[csv_columns.track_title]}`
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
        let constructed_title = construct_search_string(track_info)
        console.log(constructed_title)
        let search_results = await ytsr(construct_search_string(track_info),{limit:30})
        
        for(let result of search_results.items){
            //Find first result that meets our criteria
            //Is ths song too long?
            if(result?.duration){
                let video_duration_seconds = hmsToSecondsOnly(result.duration)
                if(video_duration_seconds >= max_song_length){
                    console.log(`${result.title} (${video_duration_seconds}) seconds (bad)`)
                    continue
                }else{
                    console.log(`${result.title} (${video_duration_seconds}) seconds (good)`)
                }
            }

            //Does the title contain 'remix' related terms (when it should not)
            let blacklisted_terms = ["full","complete","remix","cover","nightcore","extended","loop","8bit","remaster","remake","definitive","orchestral","jazz","mix","jazz","metal","relaxing","slow","fast","bass boost","chiptune"]
            if(result.title){
                if(title_contains_blacklisted_words(result.title.toLowerCase(),constructed_title.toLowerCase(),blacklisted_terms)){
                    continue
                }
            }

            let valid = await check_url_validity(result.url)
            if(valid){
                track_info.title = result.title
                link = result.url
                console.log('title=',track_info.title)
                return link
            }
        }
    }
    return link
}

function title_contains_blacklisted_words(video_title,expected_title,blacklisted_terms){
    for(let term of blacklisted_terms){
        let should_contain_term = expected_title.includes(term)
        if(video_title.includes(term) && !should_contain_term){
            console.log(`${video_title} includes (${term}) (bad)`)
            return true
        }
    }
    return false
}

//TODO tick of tracks that are finished and resave the CSV

function download_track(track_ytdl_info,output_path){
    return new Promise((resolve,reject)=>{
        console.log('starting download for',track_ytdl_info.videoDetails.title)
        let stream = ytdl(track_ytdl_info.videoDetails.videoId, {
            quality: 'highestaudio',
        });
        let start = Date.now();
        ffmpeg(stream)
        .audioBitrate(128)
        .save(output_path)
        .on('progress', (p) => {
            console.log(`${p.targetSize}kb downloaded`);
        })
        .on('end', () => {
            console.log(`done, thanks - ${(Date.now() - start) / 1000}s`);
            resolve()
        })
        .on('error', (error) => {
            console.log(`error downloading track`,track_ytdl_info,error);
            reject(error)
        });
    })
}

async function add_link_to_list(track_info){
    if(track_info[csv_columns.dont_download_flag] != ""){
        console.log(`skipped ${track_info[csv_columns.track_title]}`)
        return
    }
    try{
        let download_link = await identify_download_link(track_info)
        if(download_link){
            let info = await ytdl.getInfo(download_link)
            try{
                let output_file_name = make_download_name(track_info,info)
                let output_path = path.join(output_folder,output_file_name)
                await download_track(info,output_path)
                track_info[csv_columns.dont_download_flag] = "TRUE"
                await save_csv(csv,csv_file_path_out)
            }catch(e){
                console.log(`error downloading video`,e)
            }
        }else{
            console.log(`unable to find valid video for ${output_file_name}`)
        }
    }catch(e){
        console.log('unable to use download link',e)
    }
}

main()