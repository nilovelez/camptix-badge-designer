/**
 * Loads the design and saves it automatically, a moment after each change.
 */
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

const SAVE_DELAY = 1000;

export function useDesign() {
	const [ loading, setLoading ] = useState( true );
	const [ loadError, setLoadError ] = useState( null );
	const [ design, setDesign ] = useState( null );
	// Data about the background that is not stored in the design: its URL and file name.
	const [ backgroundFile, setBackgroundFile ] = useState( null );
	const [ saveStatus, setSaveStatus ] = useState( 'saved' );
	const [ saveError, setSaveError ] = useState( null );

	const revision = useRef( 0 );
	const latest = useRef( null );
	const queue = useRef( Promise.resolve() );
	const timer = useRef( null );

	useEffect( () => {
		apiFetch( { path: '/ctbg/v1/design' } )
			.then( ( response ) => {
				latest.current = response.design;
				setDesign( response.design );
				setBackgroundFile( response.background );
			} )
			.catch( ( error ) =>
				setLoadError( error.message || String( error ) )
			)
			.finally( () => setLoading( false ) );
	}, [] );

	const save = useCallback( () => {
		queue.current = queue.current.then( async () => {
			const savedRevision = revision.current;
			setSaveStatus( 'saving' );
			try {
				await apiFetch( {
					path: '/ctbg/v1/design',
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

	/**
	 * Changes the design and schedules a save.
	 *
	 * @param {Function} updater Receives the current design, returns the new one.
	 */
	const updateDesign = useCallback(
		( updater ) => {
			const next = updater( latest.current );
			latest.current = next;
			revision.current++;
			setDesign( next );
			setSaveStatus( 'unsaved' );
			clearTimeout( timer.current );
			timer.current = setTimeout( save, SAVE_DELAY );
		},
		[ save ]
	);

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
		backgroundFile,
		setBackgroundFile,
		saveStatus,
		saveError,
	};
}

/**
 * The attendee list from the server.
 *
 * @return {{data: Object|null, error: string|null}} Attendees.
 */
export function useAttendees() {
	const [ data, setData ] = useState( null );
	const [ error, setError ] = useState( null );
	useEffect( () => {
		apiFetch( { path: '/ctbg/v1/attendees' } )
			.then( setData )
			.catch( ( e ) => setError( e.message || String( e ) ) );
	}, [] );
	return { data, error };
}
