import { SvelteComponent } from 'svelte';

declare module '*.svelte' {
    export default class extends SvelteComponent<any, any, any> { }
}
