Track = (
function() {
    var HIT_TYPE_CIRCLE = 1,
        HIT_TYPE_SLIDER = 2,
        HIT_TYPE_NEWCOMBO = 4,
        HIT_TYPE_SPINNER = 8;

    function Track(text) {
        var self = this;
        this.general = {};
        this.metadata = {};
        this.difficulty = {};
        this.colors = [];
        this.events = [];
        this.timingPoints = [];
        this.hitObjects = [];

        // Decodes a .osu file
        var lines = text.replace("\r", "").split("\n");
        if (lines[0] != "osu file format v14") {
            // TODO: Do we care?
        }
        var section = null;
        var combo = 0, index = 0;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line === "") continue;
            if (line.indexOf("//") === 0) continue;
            if (line.indexOf("[") === 0) {
                section = line;
                continue;
            }
            switch (section) {
                case "[General]":
                    var key = line.substr(0, line.indexOf(":"));
                    var value = line.substr(line.indexOf(":") + 1).trim();
                    if (isNaN(value)) {
                        self.general[key] = value;
                    } else {
                        self.general[key] = (+value);
                    }
                    break;
                case "[Metadata]":
                    var key = line.substr(0, line.indexOf(":"));
                    var value = line.substr(line.indexOf(":") + 1).trim();
                    if (isNaN(value)) {
                        self.metadata[key] = value;
                    } else {
                        self.metadata[key] = (+value);
                    }
                    break;
                case "[Events]":
                    self.events.push(line.split(","));
                    break;
                case "[Difficulty]":
                    var parts = line.split(":");
                    var value = parts[1].trim();
                    if (isNaN(value)) {
                        self.difficulty[parts[0]] = value;
                    } else {
                        self.difficulty[parts[0]] = (+value);
                    }
                    break;
                case "[TimingPoints]":
                    var parts = line.split(",");
                    var t = {
                        offset: +parts[0],
                        millisecondsPerBeat: +parts[1],
                        meter: +parts[2],
                        sampleSet: +parts[3],
                        sampleIndex: +parts[4],
                        volume: +parts[5],
                        uninherited: +parts[6],
                        kaiMode: +parts[7]
                    };
                    if (t.millisecondsPerBeat < 0) {
                        t.uninherited = 0;
                    }
                    this.timingPoints.push(t);
                    break;
                case "[Colours]":
                    var parts = line.split(":");
                    var value = parts[1].trim();
                    self.colors.push(value.split(','));
                    break;
                case "[HitObjects]":
                    var parts = line.split(",");
                    var hit = {
                        x: +parts[0],
                        y: +parts[1],
                        time: +parts[2],
                        type: +parts[3],
                        hitSound: +parts[4]
                    };
                    // Handle combos
                    if ((hit.type & HIT_TYPE_NEWCOMBO) > 0) {
                        combo++;
                        index = 0;
                    }
                    hit.combo = combo;
                    hit.index = index++;

                    // Decode specific hit object type
                    if ((hit.type & HIT_TYPE_CIRCLE) > 0) {
                        hit.type = "circle";
                        // parse hitSample
                        const hitSample = (parts.length > 5? parts[5]: '0:0:0:0:').split(":");
                        hit.hitSample = {
                            normalSet: +hitSample[0],
                            additionSet: +hitSample[1],
                            index: +hitSample[2],
                            volume: +hitSample[3],
                            filename: hitSample[4]
                        };
                    } else if ((hit.type & HIT_TYPE_SLIDER) > 0) {
                        hit.type = "slider";
                        var sliderKeys = parts[5].split("|");
                        hit.sliderType = sliderKeys[0];
                        hit.keyframes = [];
                        for (var j = 1; j < sliderKeys.length; j++) {
                            var p = sliderKeys[j].split(":");
                            hit.keyframes.push({ x: +p[0], y: +p[1] });
                        }
                        hit.repeat = +parts[6];
                        hit.pixelLength = +parts[7];

                        if (parts.length > 8) {
                            hit.edgeHitsounds = parts[8].split("|").map(Number);
                        }
                        else {
                            hit.edgeHitsounds = new Array();
                            for (var wdnmd=0; wdnmd<hit.repeat+1; wdnmd++)
                                hit.edgeHitsounds.push(0);
                        }

                        hit.edgeSets = new Array();
                        for (var wdnmd=0; wdnmd<hit.repeat+1; wdnmd++)
                            hit.edgeSets.push({
                                normalSet: 0,
                                additionSet: 0
                            });
                        if (parts.length > 9) {
                            var additions = parts[9].split("|");
                            for (var wdnmd=0; wdnmd<additions.length; wdnmd++) {
                                var sets = additions[wdnmd].split(":");
                                hit.edgeSets[wdnmd].normalSet = +sets[0];
                                hit.edgeSets[wdnmd].additionSet = +sets[1]
                            }
                        }
                        // parse hitSample
                        const hitSample = (parts.length > 10? parts[10]: '0:0:0:0:').split(":");
                        hit.hitSample = {
                            normalSet: +hitSample[0],
                            additionSet: +hitSample[1],
                            index: +hitSample[2],
                            volume: +hitSample[3],
                            filename: hitSample[4]
                        };
                    } else if ((hit.type & HIT_TYPE_SPINNER) > 0) {
                        hit.type = "spinner";
                        hit.endTime = +parts[5];
                        if (hit.endTime < hit.time)
                            hit.endTime = hit.time + 1;
                        // parse hitSample
                        const hitSample = (parts.length > 6? parts[6]: '0:0:0:0:').split(":");
                        hit.hitSample = {
                            normalSet: +hitSample[0],
                            additionSet: +hitSample[1],
                            index: +hitSample[2],
                            volume: +hitSample[3],
                            filename: hitSample[4]
                        };
                    } else {
                        console.log("Attempted to decode unknown hit object type " + hit.type + ": " + line);
                    }
                    self.hitObjects.push(hit);
                    break;
            }
        }
        // Make some corrections
        this.general.PreviewTime /= 10;
        if (this.general.PreviewTime > this.hitObjects[0].time) {
            this.general.PreviewTime = 0;
        } // WTF is this

        // complete with default values
        if (this.colors.length === 0) {
            this.colors = [
                [96,159,159],
                [192,192,192],
                [128,255,255],
                [139,191,222]
            ];
        }
        if (this.difficulty.OverallDifficulty) {
            this.difficulty.HPDrainRate = this.difficulty.HPDrainRate || this.difficulty.OverallDifficulty;
            this.difficulty.CircleSize = this.difficulty.CircleSize || this.difficulty.OverallDifficulty;
            this.difficulty.ApproachRate = this.difficulty.ApproachRate || this.difficulty.OverallDifficulty;
        } else {
            console.warn("Overall Difficulty undefined");
        }

        // calculate inherited timing points
        // trueMillisecondsPerBeat represents BPM for song, which affects tick rate
        // millisecondsPerBeat, which affects slider velocity
        var last = this.timingPoints[0];
        for (var i = 0; i < this.timingPoints.length; i++) {
            var point = this.timingPoints[i];
            if (point.uninherited === 0) {
                point.uninherited = 1;
                point.millisecondsPerBeat *= -0.01 * last.millisecondsPerBeat;
                point.trueMillisecondsPerBeat = last.trueMillisecondsPerBeat;
            } else {
                last = point;
                point.trueMillisecondsPerBeat = point.millisecondsPerBeat;
            }
        }
        preallocateTiming(this);
        // calculate end time of each hit object
        for (let i = 0; i < this.hitObjects.length; i++) {
            let hit = this.hitObjects[i];
            if (hit.type == "circle") hit.endTime = hit.time;
            if (hit.type == "slider") {
                hit.sliderTime = hit.timing.millisecondsPerBeat * (hit.pixelLength / this.difficulty.SliderMultiplier) / 100;
                hit.sliderTimeTotal = hit.sliderTime * hit.repeat;
                hit.endTime = hit.time + hit.sliderTimeTotal;
            }
            // spinners already have an endTime
        }
        // just give an estimated track length
        this.length = Math.round((this.hitObjects[this.hitObjects.length-1].endTime)/1000+1.5);

        calculateCurve(this);
        // stack hitobjects
        stackHitObjects(this);
    }

    return Track;

    function preallocateTiming(track) {
        let currentTimingIndex = 0;
        for (let i=0; i<track.hitObjects.length; ++i) {
            while (currentTimingIndex + 1 < track.timingPoints.length && track.timingPoints[currentTimingIndex + 1].offset <= track.hitObjects[i].time) {
                currentTimingIndex += 1;
            }
            track.hitObjects[i].timing = track.timingPoints[currentTimingIndex];
        }
    }

    function calculateCurve(track) {
        for (let i=0; i<track.hitObjects.length; ++i) {
            let hit = track.hitObjects[i];
            if (hit.type == "slider") {
                if (hit.sliderType === "P" && hit.keyframes.length == 2) {
                    // handle straight P slider
                    // Vec2f nora = new Vec2f(sliderX[0] - x, sliderY[0] - y).nor();
                    // Vec2f norb = new Vec2f(sliderX[0] - sliderX[1], sliderY[0] - sliderY[1]).nor();
                    // if (Math.abs(norb.x * nora.y - norb.y * nora.x) < 0.00001)
                    //     return new LinearBezier(this, false, scaled);  // vectors parallel, use linear bezier instead
                    // else
                    hit.curve = new CircumscribedCircle(hit);
                    if (hit.curve.length == 0) // (not sure here) fallback
                        hit.curve = new LinearBezier(hit, hit.sliderType === "L");
                }
                else {
                    if (hit.sliderType == "C")
                        console.warn(track.metadata.BeatmapID || track.metadata.Title + ':' + track.metadata.Version, "Catmull curve unsupported. fallback to bezier");
                    hit.curve = new LinearBezier(hit, hit.sliderType === "L");
                }
                if (hit.curve.length < 2) // (not sure here)
                    console.error("slider curve calculation failed");
            }
        }
    }

    function stackHitObjects(track) {
        // stack coinciding objects to make them easier to see.
        // stacked objects form chains (probably not with consecutive index)
        const AR = track.difficulty.ApproachRate;
        const approachTime = AR<5? 1800-120*AR: 1950-150*AR;
        const stackDistance = 3;
        const stackThreshold = approachTime * track.general.StackLeniency;

        // time interval between hitobject A and hitobject B
        // (it's guaranteed that A and B are not spinners)
        function getintv(A, B) {
            let endTime = A.time;
            if (A.type == "slider") {
                // add slider duration
                endTime += A.repeat * A.timing.millisecondsPerBeat * (A.pixelLength / track.difficulty.SliderMultiplier) / 100;
            }
            return B.time - endTime;
        }
        // distance (in osu! pixels) between hitobject A and hitobject B
        // (it's guaranteed that A and B are not spinners)
        function getdist(A, B) {
            let x = A.x;
            let y = A.y;
            if (A.type == "slider" && (A.repeat%2==1)) {
                x = A.curve.curve[A.curve.curve.length-1].x;
                y = A.curve.curve[A.curve.curve.length-1].y;
            }
            return Math.hypot(x-B.x, y-B.y);
        }

        let chains = new Array(); // array of chains represented by array of index
        let stacked = new Array(track.hitObjects.length); // whether a hitobject has been added to chains
        stacked.fill(false);
        for (let i=0; i<track.hitObjects.length; ++i)
        {
            if (stacked[i]) continue;
            let hitI = track.hitObjects[i];
            if (hitI.type == "spinner") continue;
            // start a new chain
            stacked[i] = true;
            let newchain = [hitI];
            // finding chain starting from hitI
            for (let j=i+1; j<track.hitObjects.length; ++j)
            {
                let hitJ = track.hitObjects[j];
                if (hitJ.type == "spinner") break;
                if (getintv(newchain[newchain.length-1], hitJ) > stackThreshold) break;
                // append hitJ to the chain if it's close in space & time
                if (getdist(newchain[newchain.length-1], hitJ) <= stackDistance) {
                    // first check if hitJ is already stacked
                    if (stacked[j]) {
                        // intersecting with a previous chain.
                        // this shouldn't happen in a usual beatmap.
                        console.warn(track.metadata.BeatmapID || track.metadata.Title + ':' + track.metadata.Version, "object stacks intersecting", i, j);
                        // quit stacking
                        break;
                    }
                    stacked[j] = true;
                    newchain.push(hitJ);
                }
            }
            if (newchain.length > 1) { // just ignoring one-element chains
                chains.push(newchain);
            }
        }
        // stack offset
        const stackScale = (1.0 - 0.7 * (track.difficulty.CircleSize - 5) / 5) / 2;
        const scaleX = stackScale * 6.4;
        const scaleY = stackScale * 6.4;
        function movehit(hit, dep) {
            hit.x += scaleX * dep;
            hit.y += scaleY * dep;
            if (hit.type == "slider") {
                for (let j=0; j<hit.keyframes.length; ++j) {
                    hit.keyframes[j].x += scaleX * dep;
                    hit.keyframes[j].y += scaleY * dep;
                }
                for (let j=0; j<hit.curve.curve.length; ++j) {
                    hit.curve.curve[j].x += scaleX * dep;
                    hit.curve.curve[j].y += scaleY * dep;
                }
            }
        }
        for (let i=0; i<chains.length; ++i) {
            if (chains[i][0].type == "slider") {
                // fix this slider and move objects below
                for (let j=0, dep=0; j<chains[i].length; ++j) {
                    movehit(chains[i][j], dep);
                    if (chains[i][j].type != "slider" || chains[i][j].repeat%2==0)
                        dep++;
                }
            }
            else {
                // fix object at bottom
                for (let j=0, dep=0; j<chains[i].length; ++j) {
                    let cur = chains[i].length-1-j;
                    if (j>0 && (chains[i][cur].type == "slider" && chains[i][cur].repeat%2==1))
                        dep--;
                    movehit(chains[i][cur], -dep);
                    dep++;
                }
            }
        }
    }

})();
