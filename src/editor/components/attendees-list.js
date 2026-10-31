/**
 * The attendee list as the server sends it, so the order, the names and
 * the missing usernames can be reviewed.
 */
import { useState } from '@wordpress/element';
import { SelectControl } from '@wordpress/components';

const cellStyle = { whiteSpace: 'nowrap' };

function Summary( { data } ) {
	const { stats, attendees, questions, source } = data;
	const skipped = Object.entries( stats.skippedByStatus );
	return (
		<ul
			style={ { margin: '0 0 16px', listStyle: 'disc', paddingLeft: 20 } }
		>
			<li>
				Source: <code>{ source }</code>, { stats.rows } rows read.
			</li>
			<li>
				<strong>{ attendees.length } badges</strong>, in purchase order
				(Attendee ID).
			</li>
			{ skipped.length > 0 && (
				<li>
					Left out by ticket status:{ ' ' }
					{ skipped
						.map( ( [ status, n ] ) => status + ' (' + n + ')' )
						.join( ', ' ) }
					.
				</li>
			) }
			{ stats.malformed > 0 && (
				<li>Malformed rows skipped: { stats.malformed }.</li>
			) }
			<li>
				Without a valid WordPress.org username, so without QR code:{ ' ' }
				{ stats.withoutUsername }.
			</li>
			<li>
				Without a valid email address, so without Gravatar:{ ' ' }
				{ stats.withoutEmail }.
			</li>
			<li>
				Names with their case normalized: { stats.namesNormalized }.
			</li>
			<li>
				Variables: First name, Last name, Full name
				{ questions.map( ( q ) => ', ' + q.label ) }.
			</li>
		</ul>
	);
}

export function AttendeesList( { data } ) {
	const [ filter, setFilter ] = useState( 'all' );

	let rows = data.attendees;
	if ( filter === 'no-username' ) {
		rows = rows.filter( ( a ) => ! a.username );
	} else if ( filter === 'long' ) {
		rows = [ ...rows ]
			.sort(
				( a, b ) =>
					( b.firstName + b.lastName ).length -
					( a.firstName + a.lastName ).length
			)
			.slice( 0, 20 );
	}
	return (
		<>
			<Summary data={ data } />
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label="Show"
				value={ filter }
				options={ [
					{ label: 'All attendees', value: 'all' },
					{
						label: 'Without username (no QR code)',
						value: 'no-username',
					},
					{ label: 'The 20 longest names', value: 'long' },
				] }
				onChange={ setFilter }
			/>
			<div style={ { maxHeight: 480, overflow: 'auto', marginTop: 12 } }>
				<table className="widefat striped">
					<thead>
						<tr>
							<th>#</th>
							<th>Attendee ID</th>
							<th>First name</th>
							<th>Last name</th>
							<th>Username (QR)</th>
							<th>Gravatar</th>
							{ data.questions.map( ( q ) => (
								<th key={ q.key }>{ q.label }</th>
							) ) }
						</tr>
					</thead>
					<tbody>
						{ rows.map( ( a ) => (
							<tr key={ a.attendeeId }>
								<td>{ a.number }</td>
								<td>{ a.attendeeId }</td>
								<td style={ cellStyle }>{ a.firstName }</td>
								<td style={ cellStyle }>{ a.lastName }</td>
								<td>{ a.username || '—' }</td>
								<td>{ a.gravatarHash ? 'Yes' : '—' }</td>
								{ data.questions.map( ( q ) => (
									<td key={ q.key }>
										{ a.answers[ q.key ] }
									</td>
								) ) }
							</tr>
						) ) }
					</tbody>
				</table>
			</div>
		</>
	);
}
