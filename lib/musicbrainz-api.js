"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAndQueryString = exports.MusicBrainzApi = exports.XmlRecording = exports.XmlIsrcList = exports.XmlIsrc = exports.XmlMetadata = void 0;
const assert = require("assert");
const http_status_codes_1 = require("http-status-codes");
const Url = require("url");
const Debug = require("debug");
var xml_metadata_1 = require("./xml/xml-metadata");
Object.defineProperty(exports, "XmlMetadata", { enumerable: true, get: function () { return xml_metadata_1.XmlMetadata; } });
var xml_isrc_1 = require("./xml/xml-isrc");
Object.defineProperty(exports, "XmlIsrc", { enumerable: true, get: function () { return xml_isrc_1.XmlIsrc; } });
var xml_isrc_list_1 = require("./xml/xml-isrc-list");
Object.defineProperty(exports, "XmlIsrcList", { enumerable: true, get: function () { return xml_isrc_list_1.XmlIsrcList; } });
var xml_recording_1 = require("./xml/xml-recording");
Object.defineProperty(exports, "XmlRecording", { enumerable: true, get: function () { return xml_recording_1.XmlRecording; } });
const digest_auth_1 = require("./digest-auth");
const rate_limiter_1 = require("./rate-limiter");
const mb = require("./musicbrainz.types");
const got_1 = require("got");
const tough = require("tough-cookie");
__exportStar(require("./musicbrainz.types"), exports);
const queryString = require('query-string');
const util_1 = require("util");
const retries = 3;
const debug = Debug('musicbrainz-api');
class MusicBrainzApi {
    constructor(_config) {
        this.config = {
            baseUrl: 'https://musicbrainz.org'
        };
        Object.assign(this.config, _config);
        const cookieJar = new tough.CookieJar();
        this.getCookies = (0, util_1.promisify)(cookieJar.getCookies.bind(cookieJar));
        this.options = {
            prefixUrl: this.config.baseUrl,
            timeout: 20 * 1000,
            headers: {
                'User-Agent': `${this.config.appName}/${this.config.appVersion} ( ${this.config.appContactInfo} )`
            },
            cookieJar
        };
        this.rateLimiter = new rate_limiter_1.RateLimiter(60, 50);
    }
    static escapeText(text) {
        let str = '';
        for (const chr of text) {
            // Escaping Special Characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
            // ToDo: && ||
            switch (chr) {
                case '+':
                case '-':
                case '!':
                case '(':
                case ')':
                case '{':
                case '}':
                case '[':
                case ']':
                case '^':
                case '"':
                case '~':
                case '*':
                case '?':
                case ':':
                case '\\':
                case '/':
                    str += '\\';
            }
            str += chr;
        }
        return str;
    }
    static fetchCsrf(html) {
        return {
            sessionKey: MusicBrainzApi.fetchValue(html, 'csrf_session_key'),
            token: MusicBrainzApi.fetchValue(html, 'csrf_token')
        };
    }
    static fetchValue(html, key) {
        let pos = html.indexOf(`name="${key}"`);
        if (pos >= 0) {
            pos = html.indexOf('value="', pos + key.length + 7);
            if (pos >= 0) {
                pos += 7;
                const endValuePos = html.indexOf('"', pos);
                const value = html.substring(pos, endValuePos);
                return value;
            }
        }
    }
    async restGet(relUrl, query = {}, attempt = 1) {
        query.fmt = 'json';
        let response;
        await this.rateLimiter.limit();
        do {
            response = await got_1.default.get('ws/2' + relUrl, Object.assign({ searchParams: query, responseType: 'json' }, this.options));
            if (response.statusCode !== 503)
                break;
            debug('Rate limiter kicked in, slowing down...');
            await rate_limiter_1.RateLimiter.sleep(500);
        } while (true);
        switch (response.statusCode) {
            case http_status_codes_1.StatusCodes.OK:
                return response.body;
            case http_status_codes_1.StatusCodes.BAD_REQUEST:
            case http_status_codes_1.StatusCodes.NOT_FOUND:
                throw new Error(`Got response status ${response.statusCode}: ${(0, http_status_codes_1.getReasonPhrase)(response.status)}`);
            case http_status_codes_1.StatusCodes.SERVICE_UNAVAILABLE: // 503
            default:
                const msg = `Got response status ${response.statusCode} on attempt #${attempt} (${(0, http_status_codes_1.getReasonPhrase)(response.status)})`;
                debug(msg);
                if (attempt < retries) {
                    return this.restGet(relUrl, query, attempt + 1);
                }
                else
                    throw new Error(msg);
        }
    }
    // -----------------------------------------------------------------------------------------------------------------
    // Lookup functions
    // -----------------------------------------------------------------------------------------------------------------
    /**
     * Generic lookup function
     * @param entity
     * @param mbid
     * @param inc
     */
    getEntity(entity, mbid, inc = []) {
        return this.restGet(`/${entity}/${mbid}`, { inc: inc.join(' ') });
    }
    /**
     * Lookup area
     * @param areaId Area MBID
     * @param inc Sub-queries
     */
    getArea(areaId, inc = []) {
        return this.getEntity('area', areaId, inc);
    }
    /**
     * Lookup artist
     * @param artistId Artist MBID
     * @param inc Sub-queries
     */
    getArtist(artistId, inc = []) {
        return this.getEntity('artist', artistId, inc);
    }
    /**
     * Lookup release
     * @param releaseId Release MBID
     * @param inc Include: artist-credits, labels, recordings, release-groups, media, discids, isrcs (with recordings)
     * ToDo: ['recordings', 'artists', 'artist-credits', 'isrcs', 'url-rels', 'release-groups']
     */
    getRelease(releaseId, inc = []) {
        return this.getEntity('release', releaseId, inc);
    }
    /**
     * Lookup release-group
     * @param releaseGroupId Release-group MBID
     * @param inc Include: ToDo
     */
    getReleaseGroup(releaseGroupId, inc = []) {
        return this.getEntity('release-group', releaseGroupId, inc);
    }
    /**
     * Lookup work
     * @param workId Work MBID
     */
    getWork(workId, inc = []) {
        return this.getEntity('work', workId, inc);
    }
    /**
     * Lookup label
     * @param labelId Label MBID
     */
    getLabel(labelId) {
        return this.getEntity('label', labelId);
    }
    /**
     * Lookup recording
     * @param recordingId Label MBID
     * @param inc Include: artist-credits, isrcs
     */
    getRecording(recordingId, inc = []) {
        return this.getEntity('recording', recordingId, inc);
    }
    async postRecording(xmlMetadata) {
        return this.post('recording', xmlMetadata);
    }
    async post(entity, xmlMetadata) {
        if (!this.config.appName || !this.config.appVersion) {
            throw new Error(`XML-Post requires the appName & appVersion to be defined`);
        }
        const clientId = `${this.config.appName.replace(/-/g, '.')}-${this.config.appVersion}`;
        const path = `ws/2/${entity}/`;
        // Get digest challenge
        let digest = null;
        let n = 1;
        const postData = xmlMetadata.toXml();
        do {
            await this.rateLimiter.limit();
            const response = await got_1.default.post(path, Object.assign({ searchParams: { client: clientId }, headers: {
                    authorization: digest,
                    'Content-Type': 'application/xml'
                }, body: postData, throwHttpErrors: false }, this.options));
            if (response.statusCode === http_status_codes_1.StatusCodes.UNAUTHORIZED) {
                // Respond to digest challenge
                const auth = new digest_auth_1.DigestAuth(this.config.botAccount);
                const relPath = Url.parse(response.requestUrl).path; // Ensure path is relative
                digest = auth.digest(response.request.method, relPath, response.headers['www-authenticate']);
                ++n;
            }
            else {
                break;
            }
        } while (n++ < 5);
    }
    async login() {
        assert.ok(this.config.botAccount.username, 'bot username should be set');
        assert.ok(this.config.botAccount.password, 'bot password should be set');
        if (this.session && this.session.loggedIn) {
            for (const cookie of await this.getCookies(this.options.prefixUrl)) {
                if (cookie.key === 'remember_login') {
                    return true;
                }
            }
        }
        this.session = await this.getSession(this.config.baseUrl);
        const redirectUri = '/success';
        const formData = {
            username: this.config.botAccount.username,
            password: this.config.botAccount.password,
            csrf_session_key: this.session.csrf.sessionKey,
            csrf_token: this.session.csrf.token,
            remember_me: 1
        };
        const response = await got_1.default.post('login', Object.assign({ followRedirect: false, searchParams: {
                returnto: redirectUri
            }, form: formData }, this.options));
        const success = response.statusCode === http_status_codes_1.StatusCodes.MOVED_TEMPORARILY && response.headers.location === redirectUri;
        if (success) {
            this.session.loggedIn = true;
        }
        return success;
    }
    /**
     * Logout
     */
    async logout() {
        const redirectUri = '/success';
        const response = await got_1.default.get('logout', Object.assign({ followRedirect: false, searchParams: {
                returnto: redirectUri
            } }, this.options));
        const success = response.statusCode === http_status_codes_1.StatusCodes.MOVED_TEMPORARILY && response.headers.location === redirectUri;
        if (success) {
            this.session.loggedIn = true;
        }
        return success;
    }
    /**
     * Submit entity
     * @param entity Entity type e.g. 'recording'
     * @param mbid
     * @param formData
     */
    async editEntity(entity, mbid, formData) {
        await this.rateLimiter.limit();
        this.session = await this.getSession(this.config.baseUrl);
        formData.csrf_session_key = this.session.csrf.sessionKey;
        formData.csrf_token = this.session.csrf.token;
        formData.username = this.config.botAccount.username;
        formData.password = this.config.botAccount.password;
        formData.remember_me = 1;
        const url = `${entity}/${mbid ? `${mbid}/edit` : 'create'}`;
        const response = await got_1.default.post(url, Object.assign({ form: formData, followRedirect: false }, this.options));
        if (response.statusCode === http_status_codes_1.StatusCodes.OK)
            throw new Error(`Failed to submit form data`);
        if (response.statusCode === http_status_codes_1.StatusCodes.MOVED_TEMPORARILY) {
            if (!response.headers || !response.headers.location)
                return;
            return response.headers.location;
        }
        throw new Error(`Unexpected status code: ${response.statusCode}`);
    }
    /**
    * merge entities
    * @param entity Entity type e.g. 'recording'
    * @param mbid
    */
    async mergeEntities(entity, targetid, mbids) {
        const mergeFormData = { 'merge.edit_note': '' };
        await this.login();
        await this.rateLimiter.limit();
        for (const i in mbids) {
            // getting id from mbid
            const response = await got_1.default.get(`ws/js/entity/${mbids[i]}`, Object.assign({ followRedirect: false, responseType: 'text' }, this.options));
            const responseJson = JSON.parse(response.body);
            await this.rateLimiter.limit();
            if (!(responseJson === null || responseJson === void 0 ? void 0 : responseJson.id))
                throw new Error(`cannot find id for work ${mbids[i]}`);
            await got_1.default.get('work/merge_queue', Object.assign({ searchParams: {
                    'add-to-merge': responseJson.id
                }, followRedirect: false }, this.options));
            mergeFormData[`merge.merging.${i}`] = `${responseJson.id}`;
            if (targetid === mbids[i]) {
                mergeFormData['merge.target'] = `${responseJson.id}`;
            }
        }
        console.warn(mergeFormData);
        const url = `${entity}/merge`;
        const response = await got_1.default.post(url, Object.assign({ body: queryString.stringify(mergeFormData), followRedirect: false }, this.options));
        console.warn(response.body);
        if (response.statusCode === http_status_codes_1.StatusCodes.OK)
            throw new Error(`Failed to submit form data`);
        if (response.statusCode === http_status_codes_1.StatusCodes.MOVED_TEMPORARILY) {
            if (!response.headers || !response.headers.location)
                return;
            return response.headers.location;
        }
        throw new Error(`Unexpected status code: ${response.statusCode}`);
    }
    // /**
    //  * merge entities
    //  * @param entity Entity type e.g. 'recording'
    //  * @param mbid
    //  */
    // public async mergeEntities(entity: mb.EntityType, targetid: string, mbids: string[]): Promise<void> {
    //   if (!mbids.includes(targetid)) mbids.push(targetid);
    //   const formData:Record<string, any> = {};
    //   const mergeFormData:Record<string, any> = {};
    //   await this.rateLimiter.limit();
    //   for (const i in mbids) {
    //     // getting id from mbid
    //     const response: any = await got.get(`ws/js/entity/${mbids[i]}`, {
    //       followRedirect: false, // Disable redirects
    //       responseType: 'text',
    //       ...this.options
    //     });
    //     const responseJson = JSON.parse(response.body)
    //     await this.rateLimiter.limit();
    //     if (!responseJson?.id) throw new Error(`cannot find id for work ${mbids[i]}`);
    //     mergeFormData[`merge.merging.${i}`] = `${responseJson.id}`;
    //     if (targetid === mbids[i]) {
    //       mergeFormData['merge.target'] = `${responseJson.id}`;
    //     }
    //   }
    //   mergeFormData['merge.edit_note'] = 'same work';
    //   const url = `${entity}/merge`;
    //   console.log(url,formData);
    //   let digest: string = null;
    //   let n = 1;
    //   do {
    //     await this.rateLimiter.limit();
    //     this.session = await this.getSession(this.config.baseUrl);
    //     formData.csrf_session_key = this.session.csrf.sessionKey;
    //     formData.csrf_token = this.session.csrf.token;
    //     formData.username = this.config.botAccount.username;
    //     formData.password = this.config.botAccount.password;
    //     formData.remember_me = 1;
    //     const response: any = await got.post(url, {
    //       searchParams: { returnto: `/work/${targetid}`},
    //       form: formData,
    //       headers: {
    //         authorization: digest,
    //       },
    //       throwHttpErrors: false,
    //       ...this.options
    //     });
    //     if (response.statusCode === HttpStatus.UNAUTHORIZED) {
    //       // Respond to digest challenge
    //       const auth = new DigestAuth(this.config.botAccount);
    //       const relPath = Url.parse(response.requestUrl).path; // Ensure path is relative
    //       digest = auth.digest(response.request.method, relPath, response.headers['www-authenticate']);
    //       ++n;
    //     } else {
    //       break;
    //     }
    //   } while (n++ < 5);
    //   console.warn( queryString.stringify(mergeFormData));
    //   const response: any = await got.post(url, {
    //     searchParams: { returnto: `/work/${targetid}`},
    //     body: queryString.stringify(mergeFormData),
    //     ...this.options
    //   });
    //   console.warn(111);
    //   console.warn(response.body);
    // }
    /**
     * Set URL to recording
     * @param recording Recording to update
     * @param url2add URL to add to the recording
     * @param editNote Edit note
     */
    async addUrlToRecording(recording, url2add, editNote = '') {
        const formData = {};
        formData['edit-recording.name'] = recording.title; // Required
        formData['edit-recording.comment'] = recording.disambiguation;
        formData['edit-recording.make_votable'] = true;
        formData['edit-recording.url.0.link_type_id'] = url2add.linkTypeId;
        formData['edit-recording.url.0.text'] = url2add.text;
        for (const i in recording.isrcs) {
            formData[`edit-recording.isrcs.${i}`] = recording.isrcs[i];
        }
        formData['edit-recording.edit_note'] = editNote;
        return this.editEntity('recording', recording.id, formData);
    }
    /**
     * Add ISRC to recording
     * @param recording Recording to update
     * @param isrc ISRC code to add
     * @param editNote Edit note
     */
    async addIsrc(recording, isrc, editNote = '') {
        const formData = {};
        formData[`edit-recording.name`] = recording.title; // Required
        if (!recording.isrcs) {
            throw new Error('You must retrieve recording with existing ISRC values');
        }
        if (recording.isrcs.indexOf(isrc) === -1) {
            recording.isrcs.push(isrc);
            for (const i in recording.isrcs) {
                formData[`edit-recording.isrcs.${i}`] = recording.isrcs[i];
            }
            return this.editEntity('recording', recording.id, formData);
        }
    }
    // -----------------------------------------------------------------------------------------------------------------
    // Query functions
    // -----------------------------------------------------------------------------------------------------------------
    /**
     * Search an entity using a search query
     * @param query e.g.: '" artist: Madonna, track: Like a virgin"' or object with search terms: {artist: Madonna}
     * @param entity e.g. 'recording'
     * @param query Arguments
     */
    search(entity, query) {
        const urlQuery = Object.assign({}, query);
        if (typeof query.query === 'object') {
            urlQuery.query = makeAndQueryString(query.query);
        }
        if (Array.isArray(query.inc)) {
            urlQuery.inc = urlQuery.inc.join(' ');
        }
        return this.restGet('/' + entity + '/', urlQuery);
    }
    // -----------------------------------------------------------------------------------------------------------------
    // Helper functions
    // -----------------------------------------------------------------------------------------------------------------
    /**
     * Add Spotify-ID to MusicBrainz recording.
     * This function will automatically lookup the recording title, which is required to submit the recording URL
     * @param recording MBID of the recording
     * @param spotifyId Spotify ID
     * @param editNote Comment to add.
     */
    addSpotifyIdToRecording(recording, spotifyId, editNote) {
        assert.strictEqual(spotifyId.length, 22);
        return this.addUrlToRecording(recording, {
            linkTypeId: mb.LinkType.stream_for_free,
            text: 'https://open.spotify.com/track/' + spotifyId
        }, editNote);
    }
    searchArea(query) {
        return this.search('area', query);
    }
    searchArtist(query) {
        return this.search('artist', query);
    }
    searchRelease(query) {
        return this.search('release', query);
    }
    searchReleaseGroup(query) {
        return this.search('release-group', query);
    }
    searchUrl(query) {
        return this.search('url', query);
    }
    async getSession(url) {
        const response = await got_1.default.get('login', Object.assign({ followRedirect: false, responseType: 'text' }, this.options));
        return {
            csrf: MusicBrainzApi.fetchCsrf(response.body)
        };
    }
}
exports.MusicBrainzApi = MusicBrainzApi;
function makeAndQueryString(keyValuePairs) {
    return Object.keys(keyValuePairs).map(key => `${key}:"${keyValuePairs[key]}"`).join(' AND ');
}
exports.makeAndQueryString = makeAndQueryString;
//# sourceMappingURL=musicbrainz-api.js.map