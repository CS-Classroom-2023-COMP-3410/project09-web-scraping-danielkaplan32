const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');

axios.get('https://bulletin.du.edu/undergraduate/coursedescriptions/comp/')
    .then(response => {
        const $ = cheerio.load(response.data);
        const results = [];

        $('.courseblock').each((i, e) => {
            const fullText = $(e).text();
            const title = $(e).find('.courseblocktitle').text();
            
            // 4 digit number
            const courseNum = parseInt(title.split('COMP')[1]);

            // Title: strip course num and parenthesis
            let cleanTitle = title.split(courseNum)[1]; 
            cleanTitle = cleanTitle.split('(')[0];
            cleanTitle = cleanTitle.trim();

            // 3XXX level and no prereqs
            if (courseNum >= 3000 && !fullText.includes('Prerequisite')) {
                results.push({
                    course: "COMP-" + courseNum,
                    title: cleanTitle
                });
            }
        });

        fs.outputJsonSync('results/bulletin.json', { courses: results }, { spaces: 4 });
        console.log('Saved bulletin.json');
    })
    .catch(error => console.error(error));

    
axios.get('https://denverpioneers.com/services/adaptive_components.ashx?type=events&count=10') // Carosel provisons 10
    .then(response => {
        const results = [];

        response.data.forEach(item => {
            results.push({
                duTeam: item.sport.title,
                opponent: item.opponent.title,
                date: item.date
            });
        });

        fs.outputJsonSync('results/athletic_events.json', { events: results }, { spaces: 4 });
        console.log('Saved athletic_events.json');
    })
    .catch(error => console.error(error));


axios.get('https://www.du.edu/calendar?search=&start_date=2025-01-01&end_date=2025-12-31')
    .then(res => {
        const $ = cheerio.load(res.data);
        const eventLinks = [];

        $('.events-listing__item a.event-card').each((i, el) => {
            let link = $(el).attr('href');
            let fullUrl = "";

            if (link.startsWith('http')) {
                fullUrl = link;
            } else {
                fullUrl = 'https://www.du.edu' + link;
            }
            
            const justDate = $(el).find('p').first().text().trim();
            const dateWithYear = justDate + ", 2025";
            
            let p = axios.get(fullUrl).then(detailRes => {
                return {
                    pageHtml: detailRes.data,
                    theDate: dateWithYear
                };
            });

            eventLinks.push(p);
        });

        return axios.all(eventLinks);
    })
    .then(allPages => {
        const finalEvents = [];
        const duplicateCheck = new Set(); 

        for (let i = 0; i < allPages.length; i++) {
            let item = allPages[i];
            const $page = cheerio.load(item.pageHtml);
            const eventTitle = $page('h1').text().trim();
            
            const id = eventTitle + item.theDate;

            if (duplicateCheck.has(id) == false) {
                duplicateCheck.add(id);

                const info = {
                    title: eventTitle,
                    date: item.theDate
                };

                let time = $page('.icon-du-clock').parent().text();
                
                time = time.replace('Add to Calendar', '');
                time = time.trim();

                if (time != "") {
                    let timeParts = time.split('\n');
                    info.time = timeParts[0].trim();
                }

                let desc = $page('div[itemprop="description"]').text();
                desc = desc.trim();
                
                if (desc != "") {
                    info.description = desc;
                }

                finalEvents.push(info);
            }
        }

        fs.outputJsonSync('results/calendar_events.json', { events: finalEvents }, { spaces: 4 });
        console.log('Saved calendar_events.json');
    })
    .catch(error => console.error(error));
    