var _ = require("lodash");
// require csvtojson module

const fs = require("fs");

var jsonQuery = require("json-query");
const CSVToJSON = require("csvtojson");
const { resolve } = require("path");

let RvList = [];
let GeneList = [];
let FullGeneList = [];

/* build the gene array */

// async implement
let readGeneCSV = async () => {
  let GeneJSON = await CSVToJSON().fromFile("./Data/Genes.csv");

  return new Promise((resolve) => {
    GeneJSON.forEach((ele) => {
      GeneList.push(ele.GeneName);
      RvList.push(ele.AccessionNumber);

      //RvList = [...new Set(RvList.map((record) => record))];
      FullGeneList[ele.GeneName] = ele;
      FullGeneList[ele.AccessionNumber] = ele;
    });
    resolve();
  });
};

/* end building the gene array */

let selectRvs = (record) => {
  var selectRvListL1 = jsonQuery("rcsb_entity_source_organism[**]", {
    data: record.data.polymer_entities,
  }).value.filter((element) => {
    return element !== null;
  });
  var selectRvList2 = jsonQuery("rcsb_gene_name[**]", {
    data: selectRvListL1,
  }).value.filter((element) => {
    return element !== null;
  });

  return selectRvList2;
};

/* Generate Structure URL */

let generateStructURL = (pdbid) => {
  pdbid = pdbid.toLowerCase();
  let rootURL = pdbid.substring(1, 3);

  let str =
    "https://cdn.rcsb.org/images/structures/" +
    rootURL +
    "/" +
    pdbid +
    "/" +
    pdbid +
    "_assembly-1.jpeg";

  return str;
};

/* Generate ORF and PDB Id array */
let generateORFPDBID = () => {
  let orfPdbID = [];
  let rawData = fs.readFileSync("./Data/two.json");
  let pdbRecords = JSON.parse(rawData);

  let failedRecords = [];

  pdbRecords.forEach((record) => {
    var success = false;
    var selectedRvs = selectRvs(record); // selected Rvs from array object
    var uniqueRvs = [...new Set(selectedRvs.map((record) => record.value))]; // select unique Rvs

    uniqueRvs.forEach((rv) => {
        console.log(rv);
      if (success) return;
      if (GeneList.includes(rv)) {
        console.log("Found on GeneList")
        success = true;
        orfPdbID.push({
          ORF: rv,
          PDBId: record.data.rcsb_id,
          Authors: record.data.rcsb_primary_citation.rcsb_authors,
          Title: record.data.rcsb_primary_citation.title,
        });
      } else if (RvList.includes(rv)) {
        success = true;
        orfPdbID.push({
          ORF: rv,
          PDBId: record.data.rcsb_id,
          Authors: record.data.rcsb_primary_citation.rcsb_authors,
          Title: record.data.rcsb_primary_citation.title,
        });
      }
    });

    if (!success) {
      failedRecords.push(record);
    }
  });
  //Test
  //console.log(JSON.stringify(failedRecords, null, 2));

  return orfPdbID;
};

/* Generate HTML */
let generateHTML = (elements) => {
  let tables = "";

  elements.forEach((element) => {
    tables = tables + outerTableHtml(element);
  });

  let style = `
  <html>
  <head>
    <style>
table {
  font-family: arial, sans-serif;
  border-collapse: collapse;
  width: 100%;
}

td, th {
  border: 1px solid #cccccc;
  text-align: left;
  padding: 8px;
}

</style>
</head>
<body>
<table>
<tr><th>ORF ID</th><th>Gene name</th><th width="300">Function</th><td><table><tr><th width="200">Image</th><th width="100">PDB ID</th><th width="500">Structure Title</th><th width=200>Authors</th></tr></table></td></tr>`;

  let final = style + tables + "</table></body></html>";
  return final;
};

let outerTableHtml = (e) => {
  let st = "";
  e.SubTable.forEach((ie) => {
    st = st + innerTableHtml(ie);
  });

  return `<tr><td>${e.ORF}</td><td>${e.GeneName}</td><td width="300">${e.Function}</td><td>${st}</td></tr>`;
};

let innerTableHtml = (e) => {
  let authors = "<ul>";
  e.Authors.forEach((a) => {
    authors = authors + "<li>" + a + "</li>";
  });
  authors = authors + "</ul>";
  return `<table><tr><td width="200"><img src=${e.ImageURL} width=200/></td><td width="100"><a href="https://www.rcsb.org/structure/${e.PDBId}">${e.PDBId}</a></td><td width="500"> ${e.Title}</td><td width=200>${authors}</td></tr></table>`;
};

/* Main function */
let begin = async () => {
  await readGeneCSV();
  let orfPdbList = generateORFPDBID();
  console.log(orfPdbList.length);
  const groupByORF = _.groupBy(orfPdbList, (item) => {
    return item.ORF;
  });
  //console.log(groupByORF);

  let RvTable = [];

  Object.entries(groupByORF).forEach(([orf, values]) => {
    let subTable = values.map((ele) => {
      return {
        ImageURL: generateStructURL(ele.PDBId),
        PDBId: ele.PDBId,
        Authors: ele.Authors,
        Title: ele.Title,
      };
    });

    RvTable.push({
      ORF: FullGeneList[orf].AccessionNumber,
      GeneName: FullGeneList[orf].GeneName,
      Function: FullGeneList[orf].Function,
      SubTable: subTable,
    });
  });

  let htm = generateHTML(RvTable);

  fs.writeFileSync("./RvList.html", htm, (err) => {
    console.log(err);
  });
};

begin();
