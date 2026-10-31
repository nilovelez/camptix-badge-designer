/**
 * Loads the design, keeps its undo history and saves it automatically, a
 * moment after each change.
 */
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { upgradeDesign } from './elements';

const SAVE_DELAY = 1000;
const HISTORY_LIMIT = 100;
// Changes in the same group closer than this form one undo step (typing in a field).
const GROUP_WINDOW = 1500;

export function useDesign() {
	const [ loading, setLoading ] = useState( true );
	const [ loadError, setLoadError ] = useState( null );
	const [ design, setDesign ] = useState( null );
	// Data about the background that is not stored in the design: its URL and file name.
	const [ backgroundFile, setBackgroundFile ] = useState( null );
	// URLs of the Gravatar fallback images, by attachment id.
	const [ images, setImages ] = useState( {} );
	const [ saveStatus, setSaveStatus ] = useState( 'saved' );
	const [ saveError, setSaveError ] = useState( null );
	const [ history, setHistory ] = useState( {
		canUndo: false,
		canRedo: false,
	} );

	const revision = useRef( 0 );
	const latest = useRef( null );
	const queue = useRef( Promise.resolve() );
	const timer = useRef( null );
	const past = useRef( [] );
	const future = useRef( [] );
	const lastGroup = useRef( { key: null, time: 0 } );

	const save = useCallback( () => {
		queue.current = queue.current.then( async () => {
			const savedRevision = revision.current;
			setSaveStatus( 'saving' );
			try {
				await apiFetch( {
					path: '/ctbd/v1/design',
					method: 'POST',
					data: { design: latest.current },
				} );
				setSaveError( null );
				// Changes made while saving are saved by their own timer.
				setSaveStatus(
					savedRevision === revision.current ? 'saved' : 'unsaved'
				);
			} catch ( error ) {
				setSaveError( error.message || String( error ) );
				setSaveStatus( 'error' );
			}
		} );
	}, [] );

	const commit = useCallback(
		( next ) => {
			latest.current = next;
			revision.current++;
			setDesign( next );
			setSaveStatus( 'unsaved' );
			setHistory( {
				canUndo: past.current.length > 0,
				canRedo: future.current.length > 0,
			} );
			clearTimeout( timer.current );
			timer.current = setTimeout( save, SAVE_DELAY );
		},
		[ save ]
	);

	useEffect( () => {
		apiFetch( { path: '/ctbd/v1/design' } )
			.then( ( response ) => {
				setBackgroundFile( response.background );
				setImages( response.images || {} );
				const upgraded = upgradeDesign( response.design );
				if ( upgraded ) {
					// Saved right away, but not an undo step.
					commit( upgraded );
				} else {
					latest.current = response.design;
					setDesign( response.design );
				}
			} )
			.catch( ( error ) =>
				setLoadError( error.message || String( error ) )
			)
			.finally( () => setLoading( false ) );
	}, [ commit ] );

	/**
	 * Changes the design and schedules a save.
	 *
	 * @param {(design: Object) => Object} updater Receives the current design, returns the new one.
	 * @param {string}                     [group] Changes with the same group in a row are one undo step.
	 */
	const updateDesign = useCallback(
		( updater, group ) => {
			const previous = latest.current;
			const next = updater( previous );
			if ( next === previous ) {
				return;
			}
			const now = Date.now();
			const sameGroup =
				group &&
				group === lastGroup.current.key &&
				now - lastGroup.current.time < GROUP_WINDOW;
			if ( ! sameGroup ) {
				past.current.push( previous );
				if ( past.current.length > HISTORY_LIMIT ) {
					past.current.shift();
				}
			}
			lastGroup.current = { key: group || null, time: now };
			future.current = [];
			commit( next );
		},
		[ commit ]
	);

	const undo = useCallback( () => {
		if ( ! past.current.length ) {
			return;
		}
		future.current.push( latest.current );
		lastGroup.current = { key: null, time: 0 };
		commit( past.current.pop() );
	}, [ commit ] );

	const redo = useCallback( () => {
		if ( ! future.current.length ) {
			return;
		}
		past.current.push( latest.current );
		lastGroup.current = { key: null, time: 0 };
		commit( future.current.pop() );
	}, [ commit ] );

	// Warn before leaving the page with changes not saved yet.
	useEffect( () => {
		function onBeforeUnload( event ) {
			if ( saveStatus !== 'saved' ) {
				event.preventDefault();
				event.returnValue = '';
			}
		}
		window.addEventListener( 'beforeunload', onBeforeUnload );
		return () =>
			window.removeEventListener( 'beforeunload', onBeforeUnload );
	}, [ saveStatus ] );

	return {
		loading,
		loadError,
		design,
		updateDesign,
		undo,
		redo,
		history,
		backgroundFile,
		setBackgroundFile,
		images,
		addImage: ( id, url ) =>
			setImages( ( current ) => ( { ...current, [ id ]: url } ) ),
		saveStatus,
		saveError,
	};
}

// Shown when there is no attendee list, so the design can still be laid out.
const SAMPLE_ATTENDEE = {
	number: 1,
	attendeeId: 0,
	firstName: 'Jane',
	lastName: 'Doe',
	username: 'janedoe',
	gravatarHash: '',
	answers: {},
};

/**
 * The attendee list from the server.
 *
 * @return {{data: Object|null, error: string|null, list: Array}} Attendees; list falls back to a sample attendee.
 */
export function useAttendees() {
	const [ data, setData ] = useState( null );
	const [ error, setError ] = useState( null );
	useEffect( () => {
		apiFetch( { path: '/ctbd/v1/attendees' } )
			.then( setData )
			.catch( ( e ) => setError( e.message || String( e ) ) );
	}, [] );
	const list =
		data && data.attendees.length ? data.attendees : [ SAMPLE_ATTENDEE ];
	return { data, error, list, questions: data ? data.questions : [] };
}
