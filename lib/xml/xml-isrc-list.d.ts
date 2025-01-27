import { XmlIsrc } from './xml-isrc';
export declare class XmlIsrcList {
    items: XmlIsrc[];
    pushIsrc(isrc: string): void;
    toXml(): {
        name: string;
        attrs: {
            count: number;
        };
        children: {
            name: string;
            attrs: {
                id: string;
            };
        }[];
    };
}
