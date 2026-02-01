import { storage } from "./storage";

const CAMPUS_DATA = [
  { domain: "princeton.edu", title: "Princeton University" },
  { domain: "mit.edu", title: "Massachusetts Institute of Technology" },
  { domain: "harvard.edu", title: "Harvard University" },
  { domain: "stanford.edu", title: "Stanford University" },
  { domain: "yale.edu", title: "Yale University" },
  { domain: "uchicago.edu", title: "University of Chicago" },
  { domain: "duke.edu", title: "Duke University" },
  { domain: "jhu.edu", title: "Johns Hopkins University" },
  { domain: "northwestern.edu", title: "Northwestern University" },
  { domain: "upenn.edu", title: "University of Pennsylvania" },
  { domain: "caltech.edu", title: "California Institute of Technology" },
  { domain: "cornell.edu", title: "Cornell University" },
  { domain: "brown.edu", title: "Brown University" },
  { domain: "dartmouth.edu", title: "Dartmouth College" },
  { domain: "columbia.edu", title: "Columbia University" },
  { domain: "berkeley.edu", title: "University of California, Berkeley" },
  { domain: "rice.edu", title: "Rice University" },
  { domain: "ucla.edu", title: "University of California, Los Angeles" },
  { domain: "vanderbilt.edu", title: "Vanderbilt University" },
  { domain: "cmu.edu", title: "Carnegie Mellon University" },
  { domain: "umich.edu", title: "University of Michigan--Ann Arbor" },
  { domain: "nd.edu", title: "University of Notre Dame" },
  { domain: "wustl.edu", title: "Washington University in St. Louis" },
  { domain: "emory.edu", title: "Emory University" },
  { domain: "georgetown.edu", title: "Georgetown University" },
  { domain: "unc.edu", title: "University of North Carolina at Chapel Hill" },
  { domain: "virginia.edu", title: "University of Virginia" },
  { domain: "usc.edu", title: "University of Southern California" },
  { domain: "ucsd.edu", title: "University of California, San Diego" },
  { domain: "ufl.edu", title: "University of Florida" },
  { domain: "utexas.edu", title: "University of Texas at Austin" },
  { domain: "gatech.edu", title: "Georgia Institute of Technology" },
  { domain: "nyu.edu", title: "New York University" },
  { domain: "ucdavis.edu", title: "University of California, Davis" },
  { domain: "uci.edu", title: "University of California, Irvine" },
  { domain: "bc.edu", title: "Boston College" },
  { domain: "tufts.edu", title: "Tufts University" },
  { domain: "illinois.edu", title: "University of Illinois Urbana-Champaign" },
  { domain: "wisc.edu", title: "University of Wisconsin--Madison" },
  { domain: "ucsb.edu", title: "University of California, Santa Barbara" },
  { domain: "osu.edu", title: "Ohio State University" },
  { domain: "bu.edu", title: "Boston University" },
  { domain: "rutgers.edu", title: "Rutgers University--New Brunswick" },
  { domain: "umd.edu", title: "University of Maryland, College Park" },
  { domain: "washington.edu", title: "University of Washington" },
  { domain: "lehigh.edu", title: "Lehigh University" },
  { domain: "northeastern.edu", title: "Northeastern University" },
  { domain: "purdue.edu", title: "Purdue University--West Lafayette" },
  { domain: "uga.edu", title: "University of Georgia" },
  { domain: "rochester.edu", title: "University of Rochester" },
];

export async function seedCampuses() {
  console.log("Seeding campuses...");
  let created = 0;
  let skipped = 0;

  for (const campus of CAMPUS_DATA) {
    try {
      const existing = await storage.getCampusByDomain(campus.domain);
      if (existing) {
        skipped++;
        continue;
      }
      await storage.createCampus(campus);
      created++;
    } catch (error) {
      console.error(`Failed to create campus ${campus.domain}:`, error);
    }
  }

  console.log(`Campus seeding complete: ${created} created, ${skipped} skipped`);
}
