export { XmlMetadata } from './xml/xml-metadata';
export { XmlIsrc } from './xml/xml-isrc';
export { XmlIsrcList } from './xml/xml-isrc-list';
export { XmlRecording } from './xml/xml-recording';
import { XmlMetadata } from './xml/xml-metadata';
import * as mb from './musicbrainz.types';
export * from './musicbrainz.types';
/**
 * https://musicbrainz.org/doc/Development/XML_Web_Service/Version_2#Subqueries
 */
export declare type Includes = 'artists' | 'releases' | 'recordings' | 'artist-credits' | 'isrcs' | 'url-rels' | 'release-groups' | 'aliases' | 'discids' | 'annotation' | 'media' | 'area-rels' | 'artist-rels' | 'event-rels' | 'instrument-rels' | 'label-rels' | 'place-rels' | 'recording-rels' | 'release-rels' | 'release-group-rels' | 'series-rels' | 'work-rels';
export interface IFormData {
    [key: string]: string | number;
}
export interface IMusicBrainzConfig {
    botAccount?: {
        username: string;
        password: string;
    };
    baseUrl?: string;
    appName?: string;
    appVersion?: string;
    /**
     * HTTP Proxy
     */
    proxy?: string;
    /**
     * User e-mail address or application URL
     */
    appContactInfo?: string;
}
export interface ISessionInformation {
    csrf: {
        sessionKey: string;
        token: string;
    };
    loggedIn?: boolean;
}
export declare class MusicBrainzApi {
    private static escapeText;
    readonly config: IMusicBrainzConfig;
    private rateLimiter;
    private options;
    private session;
    static fetchCsrf(html: string): {
        sessionKey: string;
        token: string;
    };
    private static fetchValue;
    private getCookies;
    constructor(_config?: IMusicBrainzConfig);
    restGet<T>(relUrl: string, query?: {
        [key: string]: any;
    }, attempt?: number): Promise<T>;
    /**
     * Generic lookup function
     * @param entity
     * @param mbid
     * @param inc
     */
    getEntity<T>(entity: mb.EntityType, mbid: string, inc?: Includes[]): Promise<T>;
    /**
     * Lookup area
     * @param areaId Area MBID
     * @param inc Sub-queries
     */
    getArea(areaId: string, inc?: Includes[]): Promise<mb.IArea>;
    /**
     * Lookup artist
     * @param artistId Artist MBID
     * @param inc Sub-queries
     */
    getArtist(artistId: string, inc?: Includes[]): Promise<mb.IArtist>;
    /**
     * Lookup release
     * @param releaseId Release MBID
     * @param inc Include: artist-credits, labels, recordings, release-groups, media, discids, isrcs (with recordings)
     * ToDo: ['recordings', 'artists', 'artist-credits', 'isrcs', 'url-rels', 'release-groups']
     */
    getRelease(releaseId: string, inc?: Includes[]): Promise<mb.IRelease>;
    /**
     * Lookup release-group
     * @param releaseGroupId Release-group MBID
     * @param inc Include: ToDo
     */
    getReleaseGroup(releaseGroupId: string, inc?: Includes[]): Promise<mb.IReleaseGroup>;
    /**
     * Lookup work
     * @param workId Work MBID
     */
    getWork(workId: string): Promise<mb.IWork>;
    /**
     * Lookup label
     * @param labelId Label MBID
     */
    getLabel(labelId: string): Promise<mb.ILabel>;
    /**
     * Lookup recording
     * @param recordingId Label MBID
     * @param inc Include: artist-credits, isrcs
     */
    getRecording(recordingId: string, inc?: Includes[]): Promise<mb.IRecording>;
    postRecording(xmlMetadata: XmlMetadata): Promise<void>;
    post(entity: mb.EntityType, xmlMetadata: XmlMetadata): Promise<void>;
    login(): Promise<boolean>;
    /**
     * Logout
     */
    logout(): Promise<boolean>;
    /**
     * Submit entity
     * @param entity Entity type e.g. 'recording'
     * @param mbid
     * @param formData
     */
    editEntity(entity: mb.EntityType, mbid: string, formData: Record<string, any>): Promise<void>;
    /**
     * Set URL to recording
     * @param recording Recording to update
     * @param url2add URL to add to the recording
     * @param editNote Edit note
     */
    addUrlToRecording(recording: mb.IRecording, url2add: {
        linkTypeId: mb.LinkType;
        text: string;
    }, editNote?: string): Promise<void>;
    /**
     * Add ISRC to recording
     * @param recording Recording to update
     * @param isrc ISRC code to add
     * @param editNote Edit note
     */
    addIsrc(recording: mb.IRecording, isrc: string, editNote?: string): Promise<void>;
    /**
     * Search an entity using a search query
     * @param query e.g.: '" artist: Madonna, track: Like a virgin"' or object with search terms: {artist: Madonna}
     * @param entity e.g. 'recording'
     * @param query Arguments
     */
    search<T extends mb.ISearchResult>(entity: mb.EntityType, query: mb.ISearchQuery): Promise<T>;
    /**
     * Add Spotify-ID to MusicBrainz recording.
     * This function will automatically lookup the recording title, which is required to submit the recording URL
     * @param recording MBID of the recording
     * @param spotifyId Spotify ID
     * @param editNote Comment to add.
     */
    addSpotifyIdToRecording(recording: mb.IRecording, spotifyId: string, editNote: string): Promise<void>;
    searchArea(query: mb.ISearchQuery & mb.ILinkedEntitiesArea): Promise<mb.IAreaList>;
    searchArtist(query: mb.ISearchQuery & mb.ILinkedEntitiesArtist): Promise<mb.IArtistList>;
    searchRelease(query: mb.ISearchQuery & mb.ILinkedEntitiesRelease): Promise<mb.IReleaseList>;
    searchReleaseGroup(query: mb.ISearchQuery & mb.ILinkedEntitiesReleaseGroup): Promise<mb.IReleaseGroupList>;
    searchUrl(query: mb.ISearchQuery & mb.ILinkedEntitiesUrl): Promise<mb.IUrlList>;
    private getSession;
}
export declare function makeAndQueryString(keyValuePairs: IFormData): string;
