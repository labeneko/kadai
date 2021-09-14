const fs = require('fs');
const csv = require('csv-parser')
const rows = [];
const dest = fs.createWriteStream('popu_ranking.txt', 'utf8');
// csv-parserの使い方は https://www.npmjs.com/package/csv-parser を見てください
fs.createReadStream('./popu_source.csv')
    .pipe(csv())
    .on('data', (row) => { // rowの中にcsvの1行が入ってます
        // rowは謎のオブジェクト形式で返ってくるんですが
        // 正直キーはいらないので値だけの配列に変換してrowsにpushします
        rows.push(Object.values(row))
    })
    .on('end', () => { // rowsの中に全部の行がとりあえず入ってるって感じです
        // 「男女計」の「総人口」のみの人口データがある行のみに絞り込みます
        const populationRows = filterPopulationRows(rows);
        // 年齢と人口のみの二次元配列にします
        const agePopulationRows = convertAgePopulationRows(populationRows);
        // 年齢と人口に年代が入った二次元配列にします
        const generationAppendedAgePopulationRows = appendGenerationPopulationRows(agePopulationRows);
        // 年代別の人口の合計が入った二次元配列にします
        const generationPopulationRows = convertGenerationPopulationRows(generationAppendedAgePopulationRows);
        // 人口が多い順に並び替えます
        const generationPopulationDescRows = sortGenerationPopulationDescRows(generationPopulationRows);
        // ランキング出力用の文字列に変換します
        const outPutString = convertOutPutString(generationPopulationDescRows);
        // 出力先に書き込みます
        dest.write(outPutString);
        dest.end();
    });



// CSVデータから、「男女計」の「総人口」のみの人口データがある行のみに絞り込みます
// ただし、年齢が「総数」のものは弾きます
// 人口が12番目にあるので、要素が12個無いのも弾きます
// 以下のような行のみ生き残ります
// "001","男女計","001","総人口","01001","0歳","00000","全国","1201","2019年10月1日現在","千人","894",""
// "001","男女計","001","総人口","01101","100歳以上","00000","全国","1201","2019年10月1日現在","千人","69",""
function filterPopulationRows(rows) {
    return rows.filter((row) => {
        if (row.length < 12) {
            return false;
        }
        if (row[1] != '男女計') {
            return false;
        }
        if (row[3] != '総人口') {
            return false;
        }
        if (row[5] == '総数') {
            return false;
        }
        return true;
    });
}

// 年齢(文字列)と人口(数字)の入った配列に変換します
// 結果は以下のようになります
// [[ '0歳', 894000 ],   [ '1歳', 941000 ],   [ '2歳', 962000 ], ... [ '100歳以上', 962000 ]]
function convertAgePopulationRows(populationRows) {
    return populationRows.map((row) => {
        return [
            row[5],
            parseInt(row[11]) * 1000, // 人口は1000人単位と割り切って1000かけてます
        ];
    });
}

// agePopulationRowsの各年齢の3番目に年代を追加します
// 以下のような形になります
// [[ '0歳', 894000, '10歳未満' ], [ '1歳', 941000, '10歳未満' ], ...   [ '100歳以上', 69000, '100歳以上' ],
function appendGenerationPopulationRows(agePopulationRows) {
    return agePopulationRows.map((row) => {
        const ageString = row[0];
        // 年齢から年代を取得
        const generation = getGeneration(ageString);
        // 年代を3番目に追加
        row.push(generation);
        return row;
    });
}

function getGeneration(ageString) {
    const age = parseInt(ageString.replace('歳', '').replace('以上', ''));
    if (age < 10) {
        return '10歳未満';
    }
    if (age < 20) {
        return '10代';
    }
    if (age < 30) {
        return '20代';
    }
    if (age < 40) {
        return '30代';
    }
    if (age < 50) {
        return '40代';
    }
    if (age < 60) {
        return '50代';
    }
    if (age < 70) {
        return '60代';
    }
    if (age < 80) {
        return '70代';
    }
    if (age < 90) {
        return '80代';
    }
    if (age < 100) {
        return '90代';
    }
    return '100歳以上'
}

// 年代別の合計人口が入った配列にします
// 結果は以下のようになります
// [[ '10歳未満', 9860000 ], [ '10代', 11170000 ], [ '20代', 12627000 ], ... [ '100歳以上', 69000 ]]
function convertGenerationPopulationRows(generationAppendedAgePopulationRows) {
    // 年齢と人口に年代が入った二次元配列から年代のみを取り出します
    const generations = extractGenerations(generationAppendedAgePopulationRows);
    // 年代別に人口を足し算していきます
    const generationPopulationRows = generations.map((generation) => {
        // 年代に該当する行のみ残します
        const generationPopulationRows = generationAppendedAgePopulationRows.filter((row) => {
            if (row[2] == generation) {
                return true;
            }
            return false;
        });

        // 年代の人口の部分を合計していきます
        const population = generationPopulationRows.reduce(function(sum, row){
            return sum + row[1];
        }, 0);
        // 1番目に年代、2番目に年代の合計人口を返します
        return [
            generation,
            population
        ];
    });
    return generationPopulationRows;
}

// 年代の文字列のみの配列を取り出します
// 結果は以下の通り
// ['10歳未満', '10代', '20代', '30代', '40代', '50代', '60代', '70代', '80代', '90代', '100歳以上']
function extractGenerations(generationAppendedAgePopulationRows) {
    // 年代の文字列を取り出します
    const generations = generationAppendedAgePopulationRows.map((row) =>{
        return row[2];
    });
    // 年代の文字列の重複を削除します
    return [...new Set(generations)];
}

// 年代の人口が多い順に並び替えます
function sortGenerationPopulationDescRows(generationPopulationRows) {
    return generationPopulationRows.sort((a, b) => {
        return b[1] - a[1]
    });
}

// 出力用の文字列に変換します
// 以下のようになります
// 1位: 40代 18519000
// 2位: 50代 16278000
// 3位: 60代 16232000
function convertOutPutString(generationPopulationDescRows) {
    let outPutString = '';
    let rank = 1;
    for(const row of generationPopulationDescRows) {
        outPutString += `${rank}位: ${row[0]} ${row[1]}\n`;
        rank++;
    }
    return outPutString;
}