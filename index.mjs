import fs from "fs";
import cheerio from "cheerio";

const SHOW_ID = "tt15767808";

let totalPages = 1;
let currentPage = 1;
let hasGotAllPages = false;

const videosPageUrl = `https://www.imdb.com/title/${SHOW_ID}/videogallery`;
const videosPath = await getLinksStartingWith(videosPageUrl, "/videoplayer");
const videosUrl = videosPath.map((path) => `https://www.imdb.com${path}`);
const videos = [];

for (const url of videosUrl) {
  const pageProps = await getStaticPropsFromURL(url);
  const video = pageProps.videoPlaybackData.video;
  const videoName = video.name.value;
  const playback = video.playbackURLs.find(
    (playbackURL) =>
      playbackURL.mimeType === "video/mp4" &&
      playbackURL.displayName.value === "1080p"
  );
  if (!playback) {
    continue;
  }
  const directUrl = playback.url;

  videos.push({
    name: videoName,
    url: directUrl,
  });
}

fs.writeFileSync("videos.json", JSON.stringify(videos, null, 2));

async function getLinksStartingWith(url, prefix) {
  console.log(`Getting links from ${url}`);
  const response = await fetch(url);
  const html = await response.text();

  const $ = cheerio.load(html);

  if (!hasGotAllPages) {
    const pagination = $(".pagination").text();
    const totalVideos = pagination.split("of")[1]
      ? parseInt(pagination.split("of")[1].trim())
      : 0;
    totalPages = Math.ceil(totalVideos / 31);
    hasGotAllPages = true;
  }

  const links = [];
  $(".search-results").each((index, element) => {
    $(element)
      .find("li")
      .each((index, element) => {
        const link = $(element).find("a").attr("href");
        const title = $(element).find("h2").text();
        const isVideo =
          (title.toLowerCase().includes("trailer") ||
            title.toLowerCase().includes("teaser") ||
            title.toLowerCase().includes("clip")) &&
          !title.toLowerCase().includes("blu-ray/dvd");

        if (link.startsWith(prefix) && isVideo) {
          links.push(link);
        }
      });
  });

  if (currentPage < totalPages) {
    currentPage++;
    const nextUrl = `https://www.imdb.com/title/${SHOW_ID}/videogallery?page=${currentPage}`;
    const nextLinks = await getLinksStartingWith(nextUrl, prefix);
    links.push(...nextLinks);
  }

  return links;
}

async function getStaticPropsFromURL(url) {
  console.log(`Getting static props from ${url}`);
  const response = await fetch(url);
  const html = await response.text();

  const startIndex = html.indexOf("__NEXT_DATA__");
  if (startIndex === -1) {
    throw new Error("O script __NEXT_DATA__ não foi encontrado na página.");
  }

  const startSubstring = html.indexOf("{", startIndex);
  const endSubstring = html.indexOf("</script>", startSubstring);
  const json = html.substring(startSubstring, endSubstring);

  const data = JSON.parse(json);
  return data.props.pageProps;
}
