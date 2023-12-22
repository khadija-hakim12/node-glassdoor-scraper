const Scrapper = require("./GlassdoorScrapper/index.js");
require('dotenv').config();

async function startFetchingJobs(){
    const GlassDoorScrapper = new Scrapper(process.env.EMAIL,process.env.PASSWORD)
    await GlassDoorScrapper.login()
    await GlassDoorScrapper.run("react js jobs","United States" )
    if(process.env.LINKEDIN_COOKIE)
        await GlassDoorScrapper.findLinkedInDecisonMakers(process.env.LINKEDIN_COOKIE)
    await GlassDoorScrapper.dbInsertions(GlassDoorScrapper.allJobs)
     console.log( GlassDoorScrapper.allJobs)
}

startFetchingJobs()