const puppeteer = require("puppeteer");
const chalk = require("chalk");
const cheerio = require('cheerio');
const { GLASSDOOR_URL_MAIN, GLASSDOOR_SELECTOR_GOTO_ALL_JOBS, GLASSDOOR_SELECTOR_MODAL } = require("./constants");
var mysql = require('mysql2');
require('dotenv').config({ path: '../../.env' });

var con = mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,  
    user: 'root',
    password: '',
    database: 'laravel_spider',
    connectionLimit: 10
});

con.connect(function(err) {
    if (err) throw err;
    console.log("DB Connected!");
});

// Class Scrapper
// This class provides a web scraping function that logs into Glassdoor with provided user credentials and searches for jobs based on a job title and location. It uses Puppeteer to navigate and scrape data from the website.
class Scrapper {
    // Constructor for Scrapper Class. Takes email and password for Glassdoor account as arguments.
    constructor(email, password) {
        this.email = email;
        this.password = password;
        this.page = undefined;
        this.browser = undefined;
        this.jobs = [];
    }
    // Get all Jobs Getter
    get allJobs() {
        return this.jobs
    }

    async login() {
        this.browser = await puppeteer.launch({
            headless: false
        });

        this.page = await this.browser.newPage();
        await this.page.goto(GLASSDOOR_URL_MAIN);
        await this.page.waitForSelector('input[type=email]');

        await this.page.type('input[type=email]', this.email);
        await this.page.$eval('button[type=submit]', form => form.click());
        await this.page.waitForSelector('input[type=password]');
        await this.page.type('input[type=password]', this.password);
        await this.page.$eval('button[type=submit]', form => form.click());

        await this.page.waitForNavigation({ timeout: 50000 })
        console.log(chalk.green(
            'User Autheticated ' +
            chalk.blue.underline.bold('Going To Home Page') +
            ' Ready to fetch Jobs'
        ));
    }

    async run(jobTitle, country, fn = () => { }) {
        console.log(chalk.green('Started Fetching Jobs'))

        await this.page.goto(`https://www.glassdoor.com/Search/results.htm?keyword=${jobTitle}&locT=S&locName=${country}`)

        await this.page.$eval(GLASSDOOR_SELECTOR_GOTO_ALL_JOBS, (link) => { link.click() })
        await this.page.evaluate(() => { document.location.reload() })
        await this.page.waitForNavigation()

        await new Promise(r => setTimeout(r, randomInt()));
        
        await this.page.$eval(GLASSDOOR_SELECTOR_MODAL, (closeButton) => {
            closeButton.click()
        })

        let jobInsideNodeScope = await this.__extractDataFromJobList()
        this.jobs = [...jobInsideNodeScope, ...this.jobs]

        // Close The Browser
        this.browser.close()
        console.log(chalk.green(
            'Jobs Has Been Fetched ' +
            `${this.jobs.length} Jobs Fetched`
        ));
        return fn(this.jobs)


    }
    async findLinkedInDecisonMakers(cookie, keyword = "CEO") {
        console.log(chalk.green(
            'Start Fetching Decision Makers On LinkedIn '
        ));
        let jobsIteration = 0;
        while (jobsIteration != this.jobs.length - 1) {
            try {
                // Search company on LinkedIn

                this.page = await this.browser.newPage();
                const cookies = { name: 'li_at', value: cookie, domain: '.www.linkedin.com' };
                const companyLink = await this._fetchCompanyLink(this.jobs[jobsIteration].companyName, cookie); // on wait keyword VS code has claim but await need to be there
                await this.page.setCookie(cookies);
                await this.page.goto(companyLink + 'people/?keywords=' + keyword);

                // Extract links and names
                const html = await this.page.$eval('.display-flex.list-style-none.flex-wrap', el => el.innerHTML);
                const $ = cheerio.load(html);
                const links = $('li > div > section > img + div > div > div + div > div > a')
                    .map((i, el) => $(el).attr('href'))
                    .get()
                    .filter(link => link !== undefined);
                const names = $('li > div > section > img + div > div > div + div > div > a > div')
                    .map((i, el) => $(el).text())
                    .get()
                    .filter(name => name !== undefined);
                this.jobs[jobsIteration].companyDecisionMakers = {
                    links,
                    names
                }
                await browser.close();

                jobsIteration++

            } catch (error) {
                this.jobs[jobsIteration].companyDecisionMakers = {
                    links: "Not Found",
                    names: "Not Found"
                }
                jobsIteration++
                throw new Error(`Unable to fetch company decision makers: ${error}`);

            }
        }
        console.log(chalk.green(
            'Fetched Decision Makers On LinkedIn '
        ));

    };



    async _fetchCompanyLink(companyName, cookie) {
        try {
            this.page = await browser.newPage();
            const cookies = { name: 'li_at', value: cookie, domain: '.www.linkedin.com' };
            await this.page.setCookie(cookies);
            await this.page.goto(`https://www.linkedin.com/search/results/companies/?keywords=${companyName}`);
            const html = await this.page.$eval('.reusable-search__entity-result-list.list-style-none', el => el.innerHTML);
            const $ = cheerio.load(html);
            const companyCode = $('li > div').attr('data-chameleon-result-urn').split(':')[3];
            await browser.close();
            return `https://www.linkedin.com/company/${companyCode}/`;
        } catch (error) {
            throw new Error(`Unable to fetch company link: ${error.message}`);
        }
    }

    // internal function
    async __extractDataFromJobList() {
        let job = [];
        const datas = await this.page.$$('body > div:nth-child(4) > div > div > div > div > div:nth-child(2) > ul > li');
        for (let i=0; i < datas.length-1; i++) {
            let companyName = await this.page.evaluate(el => el.childNodes[0].childNodes[0].childNodes[0].childNodes[0].childNodes[0].innerText, datas[i]);
            let location = await this.page.evaluate(el => el.childNodes[0].childNodes[0].childNodes[0].childNodes[0].childNodes[2].innerText, datas[i]);
            let jobLink = await this.page.evaluate(el => el.childNodes[0].childNodes[0].childNodes[0].childNodes[0].lastChild.href, datas[i]);
            job.push({
                companyName: companyName,
                jobLink: jobLink,
                location: location,
                source: "glassDoor"
            });
        }
        return job;
    }

    async dbInsertions(data) {
        try {
            for (let i = 0; i < data.length; i++) {
                const element = data[i];
                const companyName = element.companyName.split("\n")[0];
                const url = element.jobLink;
                const address = element.location;
                var sql = "INSERT INTO businesses (scraper_job_id,company,url, address, created_at, updated_at) VALUES ?";
                var values = [[1, companyName, url, address, new Date(), new Date()]];
                con.query(sql, [values], function (err, result) {
                    if (err) {
                        console.log(err);
                    }else{
                        console.log("Number of records inserted: " + result.affectedRows);
                    }
                });
            }
        }
        catch (error) {
            throw new Error(`Unable to insert data : ${error.message}`);
        }
    }
}

module.exports = Scrapper


function randomInt() {
    return Math.floor(Math.random() * (40 - 10) + 10) + '00';
}