[out:json][timeout:240][maxsize:268435456];
area["ISO3166-1"="HK"]["boundary"="administrative"]->.scope;
nwr(area.scope)[~"^(railway|construction:railway|proposed:railway|disused:railway|abandoned:railway|preserved:railway|razed:railway)$"~"^(station|halt|tram_stop|service_station|yard|junction|spur_junction|crossover|site)$"]->.facilities;
.facilities out body geom;
.facilities out count;
