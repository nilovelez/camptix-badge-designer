/**
 * Toolbar above the canvas: add element, undo and redo; the attendee
 * pagination; the save state, Preview badge and Generate PDF.
 */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, DropdownMenu } from '@wordpress/components';
import {
	plus,
	undo,
	redo,
	chevronLeft,
	chevronRight,
	typography,
	image,
	grid,
} from '@wordpress/icons';

function saveLabel( status ) {
	const labels = {
		saved: __( 'Saved', 'camptix-badge-designer' ),
		unsaved: __( 'Unsaved changes', 'camptix-badge-designer' ),
		saving: __( 'Saving…', 'camptix-badge-designer' ),
		error: __( 'Not saved', 'camptix-badge-designer' ),
	};
	return labels[ status ];
}

function Pager( { attendees, index, onChange } ) {
	const total = attendees.length;
	const attendee = attendees[ index ];
	const [ text, setText ] = useState( String( index + 1 ) );

	useEffect( () => setText( String( index + 1 ) ), [ index ] );

	function go( number ) {
		const clamped = Math.min( total, Math.max( 1, number ) );
		onChange( clamped - 1 );
	}

	return (
		<nav
			className="ctbd-pager"
			aria-label={ __( 'Attendees', 'camptix-badge-designer' ) }
		>
			<Button
				size="small"
				icon={ chevronLeft }
				label={ __( 'Previous attendee', 'camptix-badge-designer' ) }
				disabled={ index <= 0 }
				onClick={ () => go( index ) }
			/>
			<input
				className="ctbd-pager__number"
				type="number"
				min="1"
				max={ total }
				aria-label={ __( 'Attendee number', 'camptix-badge-designer' ) }
				value={ text }
				onChange={ ( event ) => {
					setText( event.target.value );
					const number = parseInt( event.target.value, 10 );
					if ( number >= 1 && number <= total ) {
						go( number );
					}
				} }
				onBlur={ () => setText( String( index + 1 ) ) }
			/>
			<span className="ctbd-pager__total">
				{ sprintf(
					/* translators: %d: number of attendees. */
					__( 'of %d', 'camptix-badge-designer' ),
					total
				) }
			</span>
			<Button
				size="small"
				icon={ chevronRight }
				label={ __( 'Next attendee', 'camptix-badge-designer' ) }
				disabled={ index >= total - 1 }
				onClick={ () => go( index + 2 ) }
			/>
			<span
				className="ctbd-pager__name"
				title={ attendee.firstName + ' ' + attendee.lastName }
			>
				{ attendee.firstName } { attendee.lastName }
			</span>
		</nav>
	);
}

export function Toolbar( {
	attendees,
	attendeeIndex,
	onAttendee,
	onAdd,
	onUndo,
	onRedo,
	history,
	saveStatus,
	saveError,
	onPreview,
	onGenerate,
} ) {
	return (
		<div className="ctbd-toolbar">
			<DropdownMenu
				className="ctbd-toolbar__add"
				icon={ plus }
				label={ __( 'Add element', 'camptix-badge-designer' ) }
				toggleProps={ { variant: 'primary', size: 'compact' } }
				controls={ [
					{
						title: __( 'Text box', 'camptix-badge-designer' ),
						icon: typography,
						onClick: () => onAdd( 'text' ),
					},
					{
						title: __( 'Gravatar', 'camptix-badge-designer' ),
						icon: image,
						onClick: () => onAdd( 'gravatar' ),
					},
					{
						title: __(
							'QR code: profile',
							'camptix-badge-designer'
						),
						icon: grid,
						onClick: () => onAdd( 'qr' ),
					},
				] }
			/>
			<Button
				icon={ undo }
				label={ __( 'Undo', 'camptix-badge-designer' ) }
				shortcut="Ctrl+Z"
				size="compact"
				disabled={ ! history.canUndo }
				onClick={ onUndo }
			/>
			<Button
				icon={ redo }
				label={ __( 'Redo', 'camptix-badge-designer' ) }
				shortcut="Ctrl+Shift+Z"
				size="compact"
				disabled={ ! history.canRedo }
				onClick={ onRedo }
			/>
			{ /* Left-aligned, so it does not move with the length of the name. */ }
			<span className="ctbd-toolbar__gap" />
			<Pager
				attendees={ attendees }
				index={ attendeeIndex }
				onChange={ onAttendee }
			/>
			<span className="ctbd-toolbar__spacer" />
			<span
				className={ 'ctbd-toolbar__status is-' + saveStatus }
				title={ saveError || undefined }
				role="status"
			>
				{ saveLabel( saveStatus ) }
			</span>
			<Button variant="secondary" onClick={ onPreview }>
				{ __( 'Preview badge', 'camptix-badge-designer' ) }
			</Button>
			<Button variant="primary" onClick={ onGenerate }>
				{ __( 'Generate PDF', 'camptix-badge-designer' ) }
			</Button>
		</div>
	);
}
