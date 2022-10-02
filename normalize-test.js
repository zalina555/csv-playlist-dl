let NormalizeVolume = require('normalize-volume')
let options = {
    normalize:true,
    ffmpeg_bin:"./ffmpeg.exe",
    silent:false
}
let input_file = "./Battle Theme 2 OST Scrolls.mp3"
let output_file = "./Battle Theme 2 OST Scrolls-normal.mp3"
async function main(){
    try{
        await NormalizeVolume(input_file, output_file, options)
    }catch(e){
        console.log(e)
    }
}

main()